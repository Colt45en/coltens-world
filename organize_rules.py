#!/usr/bin/env python3
"""
Rules-Based File Organizer CLI

Reads YAML rules files and executes file organization operations using the agent suite.
Supports dry-run mode, undo functionality, and comprehensive audit logging.

Usage:
    python organize_rules.py <rules_file.yaml> [--dry-run] [--undo]
    python organize_rules.py --list-examples
"""

import argparse
import fnmatch
import json
import os
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List
import yaml

from servers.audit import append_ndjson

def get_folder_tree(root_path: Path, prefix: str = "") -> str:
    """Generate a tree-like string representation of the folder structure"""
    if not root_path.exists():
        return f"{root_path.name}/ (not found)"

    lines: List[str] = []
    try:
        items = sorted(root_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        for i, item in enumerate(items):
            is_last = i == len(items) - 1
            connector = "└── " if is_last else "├── "
            lines.append(f"{prefix}{connector}{item.name}{os.sep if item.is_dir() else ''}")

            if item.is_dir():
                extension = "    " if is_last else "│   "
                lines.append(get_folder_tree(item, prefix + extension))
    except PermissionError:
        lines.append(f"{prefix}└── (permission denied)")

    return "\n".join(lines)

class RulesOrganizer:
    def __init__(self, rules_file: str, dry_run: bool = False, undo: bool = False):
        self.rules_file = Path(rules_file)
        self.dry_run = dry_run
        self.undo = undo
        self.journal_file = self.rules_file.with_suffix('.journal')
        self.stats = {
            'total_files': 0,
            'moved_count': 0,
            'deleted_count': 0,
            'new_folders': 0,
            'errors': 0
        }

        if not self.rules_file.exists():
            raise FileNotFoundError(f"Rules file not found: {rules_file}")

        with open(self.rules_file, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)

        self.target_folder = Path(self.config['target_folder'])
        if not self.target_folder.exists():
            raise FileNotFoundError(f"Target folder not found: {self.target_folder}")

    def log_action(self, action: str, **kwargs: Any) -> None:
        """Log an action to the audit trail"""
        entry: Dict[str, Any] = {
            'timestamp': datetime.now().isoformat(),
            'organizer': self.rules_file.name,
            'action': action,
            'dry_run': self.dry_run,
            **kwargs
        }
        append_ndjson('organizer_actions.ndjson', entry)

    def journal_operation(self, operation: Dict[str, Any]) -> None:
        """Record operation in undo journal"""
        if self.dry_run:
            return

        entry: Dict[str, Any] = {
            'timestamp': datetime.now().isoformat(),
            'operation': operation,
            'rules_file': str(self.rules_file)
        }

        with open(self.journal_file, 'a', encoding='utf-8') as f:
            json.dump(entry, f, ensure_ascii=False)
            f.write('\n')

    def matches_pattern(self, path: Path, pattern: str) -> bool:
        """Check if path matches glob pattern"""
        try:
            return fnmatch.fnmatch(path.name, pattern)
        except Exception:
            return False

    def check_condition(self, path: Path, condition: Dict[str, Any]) -> bool:
        """Check if file meets condition criteria"""
        # Ensure path is a Path object
        if isinstance(path, str):
            path = Path(path)

        stat = path.stat()

        # Age conditions
        if 'min_age_days' in condition:
            age_days = (time.time() - stat.st_mtime) / (24 * 3600)
            if age_days < condition['min_age_days']:
                return False

        if 'max_age_days' in condition:
            age_days = (time.time() - stat.st_mtime) / (24 * 3600)
            if age_days > condition['max_age_days']:
                return False

        # File type conditions
        if 'file_type' in condition:
            ext = path.suffix.lower()
            if condition['file_type'] == 'document':
                if ext not in ['.doc', '.docx', '.pdf', '.txt', '.md']:
                    return False
            elif condition['file_type'] == 'image':
                if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
                    return False

        # Folder conditions
        if 'is_folder' in condition:
            if condition['is_folder'] != path.is_dir():
                return False

        # Name pattern
        if 'name_pattern' in condition:
            if not self.matches_pattern(path, condition['name_pattern']):
                return False

        # Parent not in list
        if 'parent_not' in condition:
            if path.parent.name in condition['parent_not']:
                return False

        # Has file condition
        if 'has_file' in condition and path.is_dir():
            if not any(path.glob(condition['has_file'])):
                return False

        return True

    def execute_action(self, source: Path, rule: Dict[str, Any]) -> bool:
        """Execute the action specified in the rule"""
        # Ensure source is a Path object
        source = Path(source)

        action = rule['action']
        print(f"Action: {action}, rule: {rule}")
        destination = rule.get('destination', '')

        # Expand variables in destination
        if destination:
            destination = destination.format(
                parent=source.parent,
                name=source.name,
                stem=source.stem,
                suffix=source.suffix
            )
            destination = Path(destination)

        try:
            if action == 'move':
                if not destination.exists():
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    self.stats['new_folders'] += 1

                if not self.dry_run:
                    shutil.move(str(source), str(destination))
                    self.journal_operation({
                        'type': 'move',
                        'source': str(source),
                        'destination': str(destination)
                    })

                self.stats['moved_count'] += 1
                self.log_action('move', source=str(source), destination=str(destination))

            elif action == 'delete':
                if not self.dry_run:
                    if source.is_file():
                        source.unlink()
                    else:
                        shutil.rmtree(source)
                    self.journal_operation({
                        'type': 'delete',
                        'path': str(source)
                    })

                self.stats['deleted_count'] += 1
                self.log_action('delete', path=str(source))

            elif action == 'ensure_structure':
                if source.is_dir():
                    structure = rule.get('structure', [])
                    for item in structure:
                        folder_path = source / item
                        if not folder_path.exists():
                            if not self.dry_run:
                                folder_path.mkdir(parents=True, exist_ok=True)
                            self.stats['new_folders'] += 1
                            self.log_action('create_folder', path=str(folder_path))

            return True

        except Exception as e:
            self.stats['errors'] += 1
            self.log_action('error', path=str(source), error=str(e))
            return False

    def process_rules(self):
        """Process all rules against the target folder"""
        print(f"Processing rules from: {self.rules_file}")
        print(f"Target folder: {self.target_folder}")
        print(f"Dry run: {self.dry_run}")
        print("-" * 50)

        # Collect all files/folders to process
        all_items = []
        if self.target_folder.is_dir():
            all_items = list(self.target_folder.rglob('*'))
        else:
            all_items = [self.target_folder]

        self.stats['total_files'] = len(all_items)

        for item in all_items:
            # Skip the rules file and journal itself
            if item == self.rules_file or item == self.journal_file:
                continue

            for rule in self.config.get('rules', []):
                pattern = rule.get('pattern', '*')
                if self.matches_pattern(item, pattern):
                    condition = rule.get('condition', {})
                    if self.check_condition(item, condition):
                        success = self.execute_action(item, rule)
                        if success:
                            break  # Stop processing this item after first matching rule

    def execute_post_actions(self):
        """Execute post-organization actions"""
        post_actions = self.config.get('post_actions', [])

        for action in post_actions:
            action_type = action.get('type')

            if action_type == 'create_note':
                self.create_note(action)

            elif action_type == 'create_index':
                self.create_index(action)

    def create_note(self, action: Dict[str, Any]):
        """Create a note file with organization summary"""
        title = action.get('title', 'Organization Complete')
        content = action.get('content', 'Files have been organized.')

        # Format content with stats
        content = content.format(**self.stats)

        note_path = self.target_folder / f"{title.replace(' ', '_')}.md"

        if not self.dry_run:
            with open(note_path, 'w', encoding='utf-8') as f:
                f.write(f"# {title}\n\n{content}\n\n")
                f.write(f"Rules file: {self.rules_file.name}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")

        self.log_action('create_note', path=str(note_path), title=title)

    def create_index(self, action: Dict[str, Any]):
        """Create an index file with folder structure"""
        index_path = Path(action.get('path', self.target_folder / 'INDEX.md'))
        content_template = action.get('content', '# Index\n\nLast updated: {timestamp}')

        # Generate folder tree
        try:
            folder_tree = get_folder_tree(self.target_folder)
        except Exception as e:
            print(f"Error in get_folder_tree: {e}")
            raise

        # Get recent files
        recent_files = []
        try:
            for item in sorted(self.target_folder.rglob('*'),
                              key=lambda x: x.stat().st_mtime, reverse=True)[:10]:
                if item.is_file():
                    mtime = datetime.fromtimestamp(item.stat().st_mtime)
                    recent_files.append(f"- {item.name} ({mtime.strftime('%Y-%m-%d')})")
        except Exception as e:
            print(f"Error in recent_files: {e}")
            raise

        recent_files_text = "\n".join(recent_files)

        # Prepare all possible placeholders
        placeholders = {
            'timestamp': datetime.now().isoformat(),
            'folder_tree': f"```\n{folder_tree}\n```",
            'recent_files': recent_files_text,
            # Add defaults for common custom placeholders
            'active_projects': '',
            'archived_projects': '',
            'total_projects': 0,
            'active_count': 0,
            'archived_count': 0,
            'project_count': 0,
            **self.stats
        }

        # Format content
        content = content_template.format(**placeholders)

        if not self.dry_run:
            index_path.parent.mkdir(parents=True, exist_ok=True)
            with open(index_path, 'w', encoding='utf-8') as f:
                f.write(content)

        self.log_action('create_index', path=str(index_path))

    def undo_last_run(self):
        """Undo the last organization run using the journal"""
        if not self.journal_file.exists():
            print("No journal file found. Cannot undo.")
            return

        operations = []
        with open(self.journal_file, 'r', encoding='utf-8') as f:
            for line in f:
                operations.append(json.loads(line))

        if not operations:
            print("No operations to undo.")
            return

        print(f"Undoing {len(operations)} operations...")

        # Reverse operations
        for entry in reversed(operations):
            op = entry['operation']

            try:
                if op['type'] == 'move':
                    # Move back
                    source = Path(op['destination'])
                    dest = Path(op['source'])
                    if source.exists():
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(source), str(dest))
                        self.log_action('undo_move', from_path=str(source), to_path=str(dest))

                elif op['type'] == 'delete':
                    # Cannot undo delete
                    self.log_action('undo_delete_failed', path=op['path'],
                                  reason="Cannot undo delete operations")

            except Exception as e:
                self.log_action('undo_error', operation=op, error=str(e))

        # Remove journal after successful undo
        self.journal_file.unlink()
        print("Undo complete.")

    def run(self):
        """Main execution method"""
        if self.undo:
            self.undo_last_run()
            return

        start_time = time.time()

        try:
            self.process_rules()
            self.execute_post_actions()
            duration = time.time() - start_time

            print("\nOrganization complete!")
            print(f"Duration: {duration:.2f} seconds")
            print(f"Total files processed: {self.stats['total_files']}")
            print(f"Files moved: {self.stats['moved_count']}")
            print(f"Files deleted: {self.stats['deleted_count']}")
            print(f"New folders created: {self.stats['new_folders']}")
            if self.stats['errors'] > 0:
                print(f"Errors: {self.stats['errors']}")

            self.log_action('complete', **self.stats, duration=duration)

        except Exception as e:
            self.log_action('failed', error=str(e))
            raise

def list_examples():
    """List available example rules files"""
    examples_dir = Path(__file__).parent
    examples = list(examples_dir.glob('rules.*.yaml'))

    if not examples:
        print("No example rules files found.")
        return

    print("Available example rules files:")
    print("-" * 40)
    for example in examples:
        config = {}
        try:
            with open(example, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
        except:
            pass

        name = config.get('name', example.stem)
        desc = config.get('description', 'No description')
        target = config.get('target_folder', 'Unknown')

        print(f"  {example.name}")
        print(f"    Name: {name}")
        print(f"    Description: {desc}")
        print(f"    Target: {target}")
        print()

def main():
    parser = argparse.ArgumentParser(description="Rules-Based File Organizer")
    parser.add_argument('rules_file', nargs='?', help='YAML rules file to process')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--undo', action='store_true', help='Undo the last organization run')
    parser.add_argument('--list-examples', action='store_true', help='List available example rules files')

    args = parser.parse_args()

    if args.list_examples:
        list_examples()
        return

    if not args.rules_file:
        parser.error("rules_file is required unless --list-examples is used")

    try:
        organizer = RulesOrganizer(args.rules_file, dry_run=args.dry_run, undo=args.undo)
        organizer.run()

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
