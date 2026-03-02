#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, List, Optional

# Ensure repo root is on sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from packages.core.policy import (  # noqa: E402
    PolicyConfig,
    add_allowed_roots,
    default_policy,
)
from packages.core.utils import ensure_dir  # noqa: E402
from packages.drivers.fs_local.organize import (  # noqa: E402
    copy_path,
    find_by_content,
    find_by_name,
    list_dir,
    mkdir,
    move_path,
    organize_by_extension,
    read_text_file,
    rename_path,
)
from packages.drivers.fs_local.rules import apply_ruleset  # noqa: E402
from packages.drivers.fs_local.undo import UndoJournal, undo_last  # noqa: E402
from packages.drivers.notes_store.driver import (  # noqa: E402
    append_note,
    create_note,
    list_notes,
    read_note,
)
from packages.drivers.web_playwright.search import duckduckgo_search  # noqa: E402

DEFAULT_UNDO_LOG = ROOT / "sandbox" / "audit" / "undo.jsonl"


def _policy_from_args(args: argparse.Namespace) -> PolicyConfig:
    cfg = default_policy(ROOT)
    roots = [Path(p).expanduser().resolve() for p in (args.allow_root or [])]
    if roots:
        cfg = add_allowed_roots(cfg, roots)
    # keep allowed_domains from default_policy
    return PolicyConfig(
        allowed_roots=cfg.allowed_roots,
        allowed_domains=cfg.allowed_domains,
        allow_destructive=bool(args.allow_destructive),
    )


def _journal_from_args(args: argparse.Namespace, policy: PolicyConfig) -> UndoJournal:
    p = (
        Path(args.undo_log).expanduser()
        if getattr(args, "undo_log", None)
        else DEFAULT_UNDO_LOG
    )
    # journal location itself must be allowed (or inside allowed root) so we can read/write it.
    # If user points it outside allowed roots, they must add --allow-root.
    p = p.resolve()
    # ensure parent exists (allowed by policy)
    # Create a temporary PolicyConfig allowing the journal parent if it isn't already.
    # But: we prefer strictness; if not allowed, raise.
    from packages.core.policy import assert_path_allowed

    assert_path_allowed(policy, p)
    ensure_dir(p.parent)
    return UndoJournal(path=p)


def _print(obj: Any) -> None:
    print(json.dumps(obj, indent=2, ensure_ascii=False))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="agent-suite",
        description="Local Files + Notes + Web helper CLI (Windows-friendly).",
    )
    p.add_argument(
        "--allow-root",
        action="append",
        default=[],
        help="Allow this path root for file operations (repeatable).",
    )
    p.add_argument(
        "--allow-destructive",
        action="store_true",
        help="Allow destructive operations (move/rename/delete via undo).",
    )

    sub = p.add_subparsers(dest="cmd", required=True)

    # ---- Files ----
    s = sub.add_parser("fs-list", help="List a folder")
    s.add_argument("--dir", required=True, help="Directory path")
    s.add_argument("--recursive", action="store_true")
    s.add_argument("--max-items", type=int, default=5000)

    s = sub.add_parser("fs-find", help="Find files by filename regex")
    s.add_argument("--dir", required=True)
    s.add_argument(
        "--pattern", required=True, help="Regex (case-insensitive) applied to filenames"
    )
    s.add_argument("--recursive", action="store_true")
    s.add_argument("--max-hits", type=int, default=500)

    s = sub.add_parser(
        "fs-grep", help="Find files by content regex (text-ish files only)"
    )
    s.add_argument("--dir", required=True)
    s.add_argument(
        "--pattern",
        required=True,
        help="Regex (case-insensitive) applied to file content",
    )
    s.add_argument("--recursive", action="store_true")
    s.add_argument("--max-hits", type=int, default=200)

    s = sub.add_parser("fs-read", help="Read a text file (with size guard)")
    s.add_argument("--path", required=True)
    s.add_argument("--max-bytes", type=int, default=256000)

    s = sub.add_parser("fs-mkdir", help="Create a directory (journaled)")
    s.add_argument("--path", required=True)
    s.add_argument("--exist-ok", action="store_true", default=True)
    s.add_argument("--undo-log", default=str(DEFAULT_UNDO_LOG))

    s = sub.add_parser("fs-move", help="Move a file or folder (journaled)")
    s.add_argument("--src", required=True)
    s.add_argument("--dst", required=True)
    s.add_argument("--overwrite", action="store_true")
    s.add_argument("--undo-log", default=str(DEFAULT_UNDO_LOG))

    s = sub.add_parser(
        "fs-copy", help="Copy a file or folder (journaled; undo deletes the copy)"
    )
    s.add_argument("--src", required=True)
    s.add_argument("--dst", required=True)
    s.add_argument("--overwrite", action="store_true")
    s.add_argument("--undo-log", default=str(DEFAULT_UNDO_LOG))

    s = sub.add_parser("fs-rename", help="Rename a file/folder (journaled)")
    s.add_argument("--src", required=True)
    s.add_argument("--new-name", required=True)
    s.add_argument("--overwrite", action="store_true")
    s.add_argument("--undo-log", default=str(DEFAULT_UNDO_LOG))

    s = sub.add_parser(
        "fs-organize-ext",
        help="Organize files into folders by extension (journaled as a batch)",
    )
    s.add_argument("--dir", required=True)
    s.add_argument("--recursive", action="store_true")
    s.add_argument("--dry-run", action="store_true")
    s.add_argument("--max-ops", type=int, default=10000)
    s.add_argument("--undo-log", default=str(DEFAULT_UNDO_LOG))

    s = sub.add_parser(
        "fs-organize-rules", help="Organize files using a JSON ruleset (journaled)"
    )
    s.add_argument("--dir", required=True, help="Root directory to scan and organize")
    s.add_argument("--rules", required=True, help="Path to ruleset JSON")
    s.add_argument("--recursive", action="store_true")
    s.add_argument("--dry-run", action="store_true")
    s.add_argument("--max-ops", type=int, default=10000)
    s.add_argument("--undo-log", default=str(DEFAULT_UNDO_LOG))

    s = sub.add_parser("fs-undo", help="Undo the last N journaled operations")
    s.add_argument("--steps", type=int, default=1)
    s.add_argument("--dry-run", action="store_true")
    s.add_argument("--undo-log", default=str(DEFAULT_UNDO_LOG))
    # ---- Notes ----
    s = sub.add_parser("notes-new", help="Create a new note")
    s.add_argument("--title", required=True)
    s.add_argument("--body", required=True)

    s = sub.add_parser("notes-append", help="Append text to a note")
    s.add_argument("--id", required=True)
    s.add_argument("--body", required=True)

    s = sub.add_parser("notes-list", help="List notes (latest first)")
    s.add_argument("--limit", type=int, default=20)

    s = sub.add_parser("notes-get", help="Get a note by id")
    s.add_argument("--id", required=True)

    # ---- Web ----
    s = sub.add_parser(
        "web-search", help="Search the web and return snippets (Playwright-based)"
    )
    s.add_argument("--q", required=True)
    s.add_argument("--limit", type=int, default=5)

    return p


def cmd_files(args: argparse.Namespace) -> Any:
    policy = _policy_from_args(
        args
    )  # Destructive gate (dry-runs should not require it)
    if args.cmd in {"fs-move", "fs-rename", "fs-undo"} and not policy.allow_destructive:
        raise PermissionError(
            "Destructive operation blocked. Re-run with --allow-destructive."
        )
    if (
        args.cmd in {"fs-organize-ext", "fs-organize-rules"}
        and (not getattr(args, "dry_run", False))
        and not policy.allow_destructive
    ):
        raise PermissionError(
            "Destructive operation blocked. Re-run with --allow-destructive."
        )

    journal = (
        _journal_from_args(args, policy) if getattr(args, "undo_log", None) else None
    )

    if args.cmd == "fs-list":
        return {
            "ok": True,
            "items": list_dir(
                policy,
                Path(args.dir),
                recursive=args.recursive,
                max_items=args.max_items,
            ),
        }
    if args.cmd == "fs-find":
        return {
            "ok": True,
            "hits": find_by_name(
                policy,
                Path(args.dir),
                args.pattern,
                recursive=args.recursive,
                max_hits=args.max_hits,
            ),
        }
    if args.cmd == "fs-grep":
        return {
            "ok": True,
            "hits": find_by_content(
                policy,
                Path(args.dir),
                args.pattern,
                recursive=args.recursive,
                max_hits=args.max_hits,
            ),
        }
    if args.cmd == "fs-read":
        return {
            "ok": True,
            "path": str(Path(args.path)),
            "text": read_text_file(policy, Path(args.path), max_bytes=args.max_bytes),
        }
    if args.cmd == "fs-mkdir":
        assert journal is not None
        return mkdir(policy, Path(args.path), exist_ok=args.exist_ok, undo=journal)
    if args.cmd == "fs-move":
        assert journal is not None
        return move_path(
            policy,
            Path(args.src),
            Path(args.dst),
            overwrite=args.overwrite,
            undo=journal,
        )
    if args.cmd == "fs-copy":
        assert journal is not None
        return copy_path(
            policy,
            Path(args.src),
            Path(args.dst),
            overwrite=args.overwrite,
            undo=journal,
        )
    if args.cmd == "fs-rename":
        assert journal is not None
        return rename_path(
            policy,
            Path(args.src),
            args.new_name,
            overwrite=args.overwrite,
            undo=journal,
        )
    if args.cmd == "fs-organize-ext":
        assert journal is not None
        return organize_by_extension(
            policy,
            Path(args.dir),
            recursive=args.recursive,
            dry_run=bool(args.dry_run),
            max_ops=args.max_ops,
            undo=journal,
        )
    if args.cmd == "fs-organize-rules":
        assert journal is not None
        return apply_ruleset(
            policy,
            Path(args.dir),
            Path(args.rules),
            recursive=args.recursive,
            dry_run=bool(args.dry_run),
            max_ops=args.max_ops,
            undo=journal,
        )
    if args.cmd == "fs-undo":
        assert journal is not None
        res = undo_last(policy, journal, steps=args.steps, dry_run=bool(args.dry_run))
        return {
            "ok": True,
            "undone": res.undone,
            "skipped": res.skipped,
            "details": res.details,
        }

    raise ValueError(f"Unknown fs cmd: {args.cmd}")


def cmd_notes(args: argparse.Namespace) -> Any:
    policy = _policy_from_args(args)
    if args.cmd == "notes-new":
        meta = create_note(policy, ROOT, title=args.title, body_md=args.body)
        try:
            from dataclasses import asdict

            return {"ok": True, "note": asdict(meta)}
        except Exception:
            return {"ok": True, "note": meta}
    if args.cmd == "notes-append":
        meta = append_note(policy, ROOT, note_id=args.id, body_md=args.body)
        try:
            from dataclasses import asdict

            return {"ok": True, "note": asdict(meta)}
        except Exception:
            return {"ok": True, "note": meta}
    if args.cmd == "notes-list":
        notes = list_notes(policy, ROOT)
        notes = notes[: args.limit]
        try:
            from dataclasses import asdict

            return {"ok": True, "notes": [asdict(n) for n in notes]}
        except Exception:
            return {"ok": True, "notes": notes}
    if args.cmd == "notes-get":
        meta, txt = read_note(policy, ROOT, note_id=args.id)
        try:
            from dataclasses import asdict

            return {"ok": True, "note": asdict(meta), "text": txt}
        except Exception:
            return {"ok": True, "note": meta, "text": txt}
    raise ValueError(f"Unknown notes cmd: {args.cmd}")


def cmd_web(args: argparse.Namespace) -> Any:
    if args.cmd == "web-search":
        import asyncio

        policy = _policy_from_args(args)
        res = asyncio.run(duckduckgo_search(policy, args.q))
        try:
            res.hits = res.hits[: args.limit]
        except Exception:
            pass
        # dataclass -> dict
        try:
            from dataclasses import asdict

            return {"ok": True, "result": asdict(res)}
        except Exception:
            return {"ok": True, "result": res}
    raise ValueError(f"Unknown web cmd: {args.cmd}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.cmd.startswith("fs-"):
            out = cmd_files(args)
        elif args.cmd.startswith("notes-"):
            out = cmd_notes(args)
        elif args.cmd.startswith("web-"):
            out = cmd_web(args)
        else:
            out = {"ok": False, "error": f"Unknown command group: {args.cmd}"}
        _print(out)
        return 0
    except Exception as e:
        _print({"ok": False, "error": str(e), "type": type(e).__name__})
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
