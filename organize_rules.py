#!/usr/bin/env python3
"""
Rules-Based File Organizer CLI (Production-Grade)

Deterministic, safe file organization with:
- Snapshot-based processing (no mutation-during-iteration errors)
- Safe move semantics (dir vs file destination detection)
- Child skipping (prevents cascaded errors from parent moves)
- UTC audit + run ID tracking
- Reversible "trash" + permanent "delete"
- Undo support via journal

Usage:
    python organize_rules.py rules.yaml [--dry-run] [--undo] [--verbose]
    python organize_rules.py --list-examples
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import shutil
import sys
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import yaml

try:
    from servers.audit import append_ndjson as _append_ndjson_external

    def append_ndjson(log_name_or_path: str, entry: Dict[str, Any]) -> None:
        """Use World Engine audit if available."""
        _append_ndjson_external(log_name_or_path, entry)

except ImportError:

    def append_ndjson(log_name_or_path: str, entry: Dict[str, Any]) -> None:
        """Fallback: write locally."""
        log_path = Path(log_name_or_path)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def utc_iso() -> str:
    """Return current UTC time as ISO 8601 string (Z format)."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path, chunk_size: int = 65536) -> str:
    """Compute SHA256 hash of file (first 16 chars)."""
    if not path.is_file():
        return "N/A"
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()[:16]
    except Exception:
        return "N/A"


def snapshot_items(root: Path) -> List[Path]:
    """
    Deterministic snapshot: sorted walk, no mutation-during-iteration.
    Returns list of (dirpath, dirnames, filenames) sorted for reproducibility.
    """
    items: List[Path] = []
    try:
        for dirpath, dirnames, filenames in os.walk(str(root)):
            dirpath_obj = Path(dirpath)
            # Sort for determinism
            dirnames.sort(key=lambda s: s.lower())
            filenames.sort(key=lambda s: s.lower())
            # Yield directories first, then files
            for dirname in dirnames:
                items.append(dirpath_obj / dirname)
            for filename in filenames:
                items.append(dirpath_obj / filename)
    except Exception:
        pass
    return items


def is_subpath(child: Path, parent: Path) -> bool:
    """Check if child is under parent directory."""
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def get_folder_tree(root_path: Path, prefix: str = "") -> str:
    """Generate a tree-like string representation of the folder structure."""
    if not root_path.exists():
        return f"{root_path.name}/ (not found)"

    lines: List[str] = []
    try:
        items = sorted(
            root_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())
        )
        for i, item in enumerate(items):
            is_last = i == len(items) - 1
            connector = "└── " if is_last else "├── "
            lines.append(
                f"{prefix}{connector}{item.name}{os.sep if item.is_dir() else ''}"
            )

            if item.is_dir():
                extension = "    " if is_last else "│   "
                lines.append(get_folder_tree(item, prefix + extension))
    except PermissionError:
        lines.append(f"{prefix}└── (permission denied)")

    return "\n".join(lines)


@dataclass
class JournalEntry:
    """Single operation recorded in journal."""

    timestamp: str  # UTC ISO string
    operation: str  # 'move' | 'delete' | 'trash' | 'mkdir' | 'create_file'
    source: Optional[str] = None
    destination: Optional[str] = None
    path: Optional[str] = None
    reason: Optional[str] = None


class RulesOrganizer:
    def __init__(
        self,
        rules_file: str,
        dry_run: bool = False,
        undo: bool = False,
        verbose: bool = False,
    ):
        self.rules_file = Path(rules_file)
        self.dry_run = dry_run
        self.undo = undo
        self.verbose = verbose
        self.run_id = str(uuid.uuid4())
        self.journal_file = self.rules_file.with_suffix(".journal")
        self.stats = {
            "total_items": 0,
            "moved_count": 0,
            "trashed_count": 0,
            "deleted_count": 0,
            "mkdir_count": 0,
            "files_created": 0,
            "errors": 0,
        }

        if not self.rules_file.exists():
            raise FileNotFoundError(f"Rules file not found: {rules_file}")

        with open(self.rules_file, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)

        self.target_folder = Path(self.config["target_folder"])
        if not self.target_folder.exists():
            raise FileNotFoundError(f"Target folder not found: {self.target_folder}")

        # Config hash for determinism
        config_str = json.dumps(self.config, sort_keys=True, ensure_ascii=False)
        self.config_hash = hashlib.sha256(config_str.encode()).hexdigest()[:16]

    def _log(self, *args: Any, **kwargs: Any) -> None:
        """Print only if verbose."""
        if self.verbose:
            print(*args, **kwargs)

    def log_action(self, action: str, **kwargs: Any) -> None:
        """Log an action to World Engine audit trail."""
        entry: Dict[str, Any] = {
            "timestamp": utc_iso(),
            "run_id": self.run_id,
            "config_hash": self.config_hash,
            "organizer": self.rules_file.name,
            "action": action,
            "dry_run": self.dry_run,
            **kwargs,
        }
        append_ndjson("organizer_actions.ndjson", entry)

    def journal_operation(self, op_type: str, **kwargs: Any) -> None:
        """Record operation in undo journal."""
        if self.dry_run:
            return

        entry = JournalEntry(timestamp=utc_iso(), operation=op_type, **kwargs)

        with open(self.journal_file, "a", encoding="utf-8") as f:
            json.dump(asdict(entry), f, ensure_ascii=False)
            f.write("\n")

    def _resolve_move_target(self, source: Path, dest: Path) -> Tuple[Path, bool]:
        """
        Resolve move destination.
        Returns (actual_destination, created_parent)

        - If dest exists and is dir: move source into dest (source.name preserved)
        - If source is file and dest has no suffix: treat dest as dir, create if needed
        - Otherwise: dest is the final filename
        """
        if dest.exists() and dest.is_dir():
            # Destination exists as directory: move into it
            actual_dest = dest / source.name
            return (actual_dest, False)

        # Check if dest looks like a directory (source is file, dest has no suffix)
        if source.is_file() and dest.suffix == "":
            # Treat dest as a directory to create
            if not dest.exists():
                dest.mkdir(parents=True, exist_ok=True)
                self.stats["mkdir_count"] += 1
                self.journal_operation("mkdir", path=str(dest))
                return (dest / source.name, True)
            else:
                # Dir exists but wasn't caught above (race condition), move into it
                return (dest / source.name, False)

        # Otherwise: dest is final file path, create parent if needed
        if not dest.parent.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            self.stats["mkdir_count"] += 1
            self.journal_operation("mkdir", path=str(dest.parent))
            return (dest, True)

        return (dest, False)

    def _trash_path(self, source: Path) -> Path:
        """Compute reversible trash path with content hash."""
        trash_root = self.target_folder / ".trash"

        # Content-based hash
        if source.is_file():
            content_hash = sha256_file(source)
        else:
            # Directory hash based on relative path
            rel_path = (
                source.relative_to(self.target_folder)
                if is_subpath(source, self.target_folder)
                else source
            )
            content_hash = hashlib.sha256(str(rel_path).encode()).hexdigest()[:16]

        # Build trash filename: original_stem__hash.original_suffix
        trash_name = f"{source.stem}__{content_hash}{source.suffix}"
        return trash_root / trash_name

    def matches_condition(self, path: Path, condition: Dict[str, Any]) -> bool:
        """Check if file meets all condition criteria."""
        if not condition:
            return True

        # Age conditions
        try:
            stat_info = path.stat()
        except FileNotFoundError:
            return False
        except Exception:
            self._log(f"  ⚠ stat() error on {path}")
            return False

        if "min_age_days" in condition:
            age_days = (time.time() - stat_info.st_mtime) / (24 * 3600)
            if age_days < condition["min_age_days"]:
                return False

        if "max_age_days" in condition:
            age_days = (time.time() - stat_info.st_mtime) / (24 * 3600)
            if age_days > condition["max_age_days"]:
                return False

        # Size conditions
        if "min_size_mb" in condition:
            size_mb = stat_info.st_size / (1024 * 1024)
            if size_mb < condition["min_size_mb"]:
                return False

        if "max_size_mb" in condition:
            size_mb = stat_info.st_size / (1024 * 1024)
            if size_mb > condition["max_size_mb"]:
                return False

        # File type conditions
        if "file_type" in condition:
            ext = path.suffix.lower()
            file_type = condition["file_type"]
            if file_type == "document":
                if ext not in [".doc", ".docx", ".pdf", ".txt", ".md"]:
                    return False
            elif file_type == "image":
                if ext not in [
                    ".jpg",
                    ".jpeg",
                    ".png",
                    ".gif",
                    ".bmp",
                    ".svg",
                    ".webp",
                ]:
                    return False
            elif file_type == "archive":
                if ext not in [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"]:
                    return False
            elif file_type == "video":
                if ext not in [".mp4", ".avi", ".mov", ".mkv", ".flv", ".wmv"]:
                    return False
            elif file_type == "audio":
                if ext not in [".mp3", ".wav", ".flac", ".aac", ".m4a", ".wma"]:
                    return False

        # Folder conditions
        if "is_folder" in condition:
            if condition["is_folder"] != path.is_dir():
                return False

        # Name pattern (shell glob on filename only, not path)
        if "name_pattern" in condition:
            pattern = condition["name_pattern"]
            if not fnmatch.fnmatch(path.name, pattern):
                return False

        # Full path match (glob on relative path)
        if "path_pattern" in condition:
            pattern = condition["path_pattern"]
            try:
                rel = path.relative_to(self.target_folder)
            except ValueError:
                rel = path
            if not fnmatch.fnmatch(str(rel), pattern):
                return False

        # Parent not in list
        if "parent_not" in condition:
            if path.parent.name in condition["parent_not"]:
                return False

        # Has file in directory
        if "has_file" in condition and path.is_dir():
            glob_pattern = condition["has_file"]
            if not any(path.glob(glob_pattern)):
                return False

        return True

    def execute_action(self, source: Path, rule: Dict[str, Any]) -> bool:
        """Execute the action specified in the rule."""
        if not source.exists():
            self._log(f"  ⚠ Path no longer exists: {source}")
            return False

        action = rule["action"]
        destination = rule.get("destination", "")

        # Expand variables in destination
        if destination:
            try:
                destination = destination.format(
                    parent=source.parent,
                    name=source.name,
                    stem=source.stem,
                    suffix=source.suffix,
                )
            except KeyError as e:
                self._log(f"  ✗ Invalid destination variable: {e}")
                self.stats["errors"] += 1
                self.log_action(
                    "error", path=str(source), reason=f"Invalid destination: {e}"
                )
                return False
            destination = Path(destination)

        try:
            if action == "move":
                actual_dest, _ = self._resolve_move_target(source, destination)
                self._log(f"  → move {source.name} → {actual_dest}")

                if not self.dry_run:
                    shutil.move(str(source), str(actual_dest))
                    self.journal_operation(
                        "move", source=str(source), destination=str(actual_dest)
                    )

                self.stats["moved_count"] += 1
                self.log_action(
                    "move", source=str(source), destination=str(actual_dest)
                )

            elif action == "trash":
                trash_dest = self._trash_path(source)
                self._log(f"  🗑 trash {source.name} → {trash_dest.name}")

                if not self.dry_run:
                    trash_dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(source), str(trash_dest))
                    self.journal_operation(
                        "trash", source=str(source), destination=str(trash_dest)
                    )

                self.stats["trashed_count"] += 1
                self.log_action(
                    "trash", source=str(source), destination=str(trash_dest)
                )

            elif action == "delete":
                self._log(f"  ✗ delete {source.name} (permanent)")

                if not self.dry_run:
                    if source.is_file():
                        source.unlink()
                    else:
                        shutil.rmtree(str(source))
                    self.journal_operation("delete", path=str(source))

                self.stats["deleted_count"] += 1
                self.log_action("delete", path=str(source))

            elif action == "ensure_structure":
                structure = rule.get("structure", [])
                self._log(f"  📁 ensure_structure in {source.name}")

                for item in structure:
                    folder_path = source / item
                    if not folder_path.exists():
                        if not self.dry_run:
                            folder_path.mkdir(parents=True, exist_ok=True)
                            self.journal_operation("mkdir", path=str(folder_path))
                        self.stats["mkdir_count"] += 1
                        self._log(f"    ↳ created {item}")
                        self.log_action("mkdir", path=str(folder_path))

            return True

        except Exception as e:
            self.stats["errors"] += 1
            self._log(f"  ✗ error: {e}")
            self.log_action("error", path=str(source), error=str(e))
            return False

    def process_rules(self):
        """Process all rules against target folder (snapshot-based, no mutation-during-iteration)."""
        if self.verbose:
            print(f"📋 Processing rules from: {self.rules_file}")
            print(f"🎯 Target folder: {self.target_folder}")
            print(f"🔍 Mode: {'DRY-RUN' if self.dry_run else 'EXECUTE'}")
            print(f"🔑 Run ID: {self.run_id}")
            print("-" * 60)

        # Snapshot items (deterministic, no mutation-during-iteration)
        items = snapshot_items(self.target_folder)

        # Track moved/deleted directories to skip their children
        moved_or_deleted_dirs: Set[Path] = set()

        self.stats["total_items"] = len(items)

        for item in items:
            # Skip if this item is a child of a moved/deleted directory
            if any(is_subpath(item, d) for d in moved_or_deleted_dirs):
                self._log(f"  ⊘ skipping child of moved dir: {item}")
                continue

            # Skip the rules file and journal
            if item == self.rules_file or item == self.journal_file:
                continue

            for rule in self.config.get("rules", []):
                pattern = rule.get("pattern", "*")

                # Flexible pattern matching
                name_match = fnmatch.fnmatch(item.name, pattern)

                # Also try path pattern if available
                try:
                    rel = item.relative_to(self.target_folder)
                    path_match = fnmatch.fnmatch(str(rel), pattern)
                except ValueError:
                    path_match = name_match

                if name_match or path_match:
                    condition = rule.get("condition", {})
                    if self.matches_condition(item, condition):
                        self._log(
                            f"✓ {item.name} (rule: {rule.get('name', 'unnamed')})"
                        )

                        success = self.execute_action(item, rule)

                        if success:
                            # Mark moved/deleted paths for child-skipping
                            action = rule["action"]
                            if action in ["move", "trash", "delete"]:
                                moved_or_deleted_dirs.add(item)
                            break  # First matching rule wins

    def execute_post_actions(self):
        """Execute post-organization actions."""
        post_actions = self.config.get("post_actions", [])

        if not post_actions:
            return

        if self.verbose:
            print("\n" + "=" * 60)
            print("📌 Post-Organization Actions")
            print("=" * 60)

        for action in post_actions:
            action_type = action.get("type")

            if action_type == "create_note":
                self.create_note(action)
            elif action_type == "create_index":
                self.create_index(action)

    def create_note(self, action: Dict[str, Any]):
        """Create a note file with organization summary."""
        title = action.get("title", "Organization Complete")
        content = action.get("content", "Files have been organized.")

        # Format content with stats
        try:
            content = content.format(**self.stats)
        except KeyError:
            pass

        note_path = self.target_folder / f"{title.replace(' ', '_')}.md"

        if not self.dry_run:
            with open(note_path, "w", encoding="utf-8") as f:
                f.write(f"# {title}\n\n{content}\n\n")
                f.write(f"Rules file: {self.rules_file.name}\n")
                f.write(f"Timestamp: {utc_iso()}\n")
                f.write(f"Run ID: {self.run_id}\n")
            self.journal_operation("create_file", path=str(note_path))
            self.stats["files_created"] += 1

        self._log(f"  📄 created {note_path.name}")
        self.log_action("create_note", path=str(note_path), title=title)

    def create_index(self, action: Dict[str, Any]):
        """Create an index file with folder structure."""
        index_path = Path(action.get("path", self.target_folder / "INDEX.md"))
        content_template = action.get("content", "# Index\n\nLast updated: {timestamp}")

        # Generate folder tree
        try:
            folder_tree = get_folder_tree(self.target_folder)
        except Exception as e:
            self._log(f"  ⚠ Error generating folder tree: {e}")
            folder_tree = "(error)"

        # Get recent files
        recent_files: List[str] = []
        try:
            for item in sorted(
                snapshot_items(self.target_folder),
                key=lambda x: x.stat().st_mtime if x.exists() else 0,
                reverse=True,
            )[:10]:
                if item.is_file():
                    try:
                        mtime = datetime.fromtimestamp(item.stat().st_mtime)
                        recent_files.append(
                            f"- {item.name} ({mtime.strftime('%Y-%m-%d')})"
                        )
                    except Exception:
                        pass
        except Exception as e:
            self._log(f"  ⚠ Error getting recent files: {e}")

        recent_files_text = "\n".join(recent_files)

        # Prepare placeholders
        placeholders: Dict[str, Any] = {
            "timestamp": utc_iso(),
            "folder_tree": f"```\n{folder_tree}\n```",
            "recent_files": recent_files_text,
            **self.stats,
        }

        # Format content
        try:
            content = content_template.format(**placeholders)
        except KeyError as e:
            content = content_template.replace(f"{{{e.args[0]}}}", "(unknown)")

        if not self.dry_run:
            index_path.parent.mkdir(parents=True, exist_ok=True)
            with open(index_path, "w", encoding="utf-8") as f:
                f.write(content)
            self.journal_operation("create_file", path=str(index_path))
            self.stats["files_created"] += 1

        self._log(f"  📑 created {index_path.name}")
        self.log_action("create_index", path=str(index_path))

    def undo_last_run(self) -> None:
        """Undo the last organization run using the journal."""
        if not self.journal_file.exists():
            print("❌ No journal file found. Cannot undo.")
            return

        operations: List[Dict[str, Any]] = []
        try:
            with open(self.journal_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        operations.append(json.loads(line))
        except Exception as e:
            print(f"❌ Error reading journal: {e}")
            return

        if not operations:
            print("❌ No operations to undo.")
            return

        print(f"🔄 Undoing {len(operations)} operations...")

        # Reverse operations
        for entry in reversed(operations):
            if "operation" in entry:
                op = entry
            else:
                op = entry.get("operation", entry)

            try:
                op_type = op.get("operation", op.get("type"))

                if op_type == "move":
                    # Move back
                    source = Path(op["destination"])
                    dest = Path(op["source"])
                    if source.exists():
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(source), str(dest))
                        print(f"  → undo move: {source.name} → {dest}")
                        self.log_action(
                            "undo_move", from_path=str(source), to_path=str(dest)
                        )

                elif op_type == "trash":
                    # Restore from trash
                    source = Path(op["destination"])
                    dest = Path(op["source"])
                    if source.exists():
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(source), str(dest))
                        print(f"  🔄 restore: {source.name} ← {dest}")
                        self.log_action(
                            "undo_trash", from_path=str(source), to_path=str(dest)
                        )

                elif op_type == "delete":
                    # Cannot undo delete
                    print(f"  ⚠ Cannot undo delete: {op.get('path')} (permanent)")
                    self.log_action("undo_delete_failed", path=op.get("path"))

                elif op_type == "mkdir":
                    # Remove created directory if empty
                    path = Path(op.get("path", ""))
                    if path.exists() and path.is_dir():
                        try:
                            path.rmdir()
                            print(f"  🗑 remove empty dir: {path.name}")
                        except OSError:
                            print(f"  ⚠ Cannot remove (not empty): {path}")

                elif op_type == "create_file":
                    # Remove created file
                    path = Path(op.get("path", ""))
                    if path.is_file():
                        path.unlink()
                        print(f"  🗑 remove file: {path.name}")

            except Exception as e:
                print(f"  ⚠ Error undoing operation: {e}")
                self.log_action("undo_error", operation=str(op), error=str(e))

        # Remove journal after successful undo
        if not self.dry_run:
            self.journal_file.unlink()
        print("✅ Undo complete.")

    def run(self):
        """Main execution method."""
        if self.undo:
            self.undo_last_run()
            return

        start_time = time.time()

        try:
            self.process_rules()
            self.execute_post_actions()
            duration = time.time() - start_time

            if self.verbose or not self.dry_run:
                print("\n" + "=" * 60)
                print("✅ Organization complete!")
                print("=" * 60)
                print(f"⏱  Duration: {duration:.2f} seconds")
                print(f"📊 Items processed: {self.stats['total_items']}")
                print(f"➡️  Moved: {self.stats['moved_count']}")
                print(f"🗑  Trashed: {self.stats['trashed_count']}")
                print(f"✗  Deleted: {self.stats['deleted_count']}")
                print(f"📁 Folders created: {self.stats['mkdir_count']}")
                print(f"📄 Files created: {self.stats['files_created']}")
                if self.stats["errors"] > 0:
                    print(f"⚠️  Errors: {self.stats['errors']}")
                if self.journal_file.exists():
                    print(f"📔 Journal: {self.journal_file.name}")
                    print(
                        f"🔄 To undo: python organize_rules.py {self.rules_file.name} --undo"
                    )

            self.log_action("complete", **self.stats, duration=duration)

        except Exception as e:
            print(f"❌ Error: {e}")
            self.log_action("failed", error=str(e))
            sys.exit(1)


def list_examples():
    """List available example rules files."""
    examples_dir = Path(__file__).parent
    examples = sorted(examples_dir.glob("rules.*.yaml"))

    if not examples:
        print("No example rules files found.")
        return

    print("📚 Available example rules files:")
    print("-" * 60)
    for example in examples:
        config: Dict[str, Any] = {}
        try:
            with open(example, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f) or {}
        except Exception:
            pass

        name = config.get("name", example.stem)
        desc = config.get("description", "No description")
        target = config.get("target_folder", "Unknown")

        print(f"  📄 {example.name}")
        print(f"     Name: {name}")
        print(f"     Description: {desc}")
        print(f"     Target: {target}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Rules-Based File Organizer (Production-Grade)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python organize_rules.py rules.yaml --dry-run --verbose
    python organize_rules.py rules.yaml --verbose
    python organize_rules.py rules.yaml --undo
    python organize_rules.py --list-examples
""",
    )
    parser.add_argument("rules_file", nargs="?", help="YAML rules file to process")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--undo", action="store_true", help="Undo the last organization run"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Show detailed progress output"
    )
    parser.add_argument(
        "--list-examples",
        action="store_true",
        help="List available example rules files",
    )

    args = parser.parse_args()

    if args.list_examples:
        list_examples()
        return

    if not args.rules_file:
        parser.error("rules_file is required unless --list-examples is used")

    try:
        organizer = RulesOrganizer(
            args.rules_file,
            dry_run=args.dry_run,
            undo=args.undo,
            verbose=args.verbose,
        )
        organizer.run()

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
