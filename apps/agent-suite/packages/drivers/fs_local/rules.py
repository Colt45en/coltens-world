from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from ...core.policy import PolicyConfig, assert_path_allowed
from ...core.utils import ensure_dir

from .undo import UndoJournal


@dataclass(frozen=True)
class RuleMatch:
    glob: Optional[str] = None
    regex: Optional[str] = None
    ext_in: Optional[List[str]] = None
    name_includes: Optional[str] = None
    path_includes: Optional[str] = None
    contains_text: Optional[str] = None
    min_size_bytes: Optional[int] = None
    max_size_bytes: Optional[int] = None
    except_glob: Optional[List[str]] = None


@dataclass(frozen=True)
class RuleAction:
    move_to: Optional[str] = None
    copy_to: Optional[str] = None
    rename: Optional[str] = None  # template
    skip_if_exists: bool = True


@dataclass(frozen=True)
class Rule:
    name: str
    when: RuleMatch
    then: RuleAction
    priority: int = 100


@dataclass(frozen=True)
class Ruleset:
    version: str
    rules: List[Rule]


TEXT_EXT_DEFAULT = {
    ".txt",
    ".md",
    ".markdown",
    ".rst",
    ".log",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".css",
    ".html",
    ".htm",
    ".csv",
}


def load_ruleset(path: Path) -> Ruleset:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("Ruleset must be a JSON object.")
    version = str(raw.get("version") or "fs-rules.v1")
    rules_raw = raw.get("rules")
    if not isinstance(rules_raw, list):
        raise ValueError("Ruleset 'rules' must be a list.")
    rules: List[Rule] = []
    for r in rules_raw:
        if not isinstance(r, dict):
            continue
        name = str(r.get("name") or "unnamed")
        pr = int(r.get("priority") or 100)
        when = r.get("when") or {}
        then = r.get("then") or {}
        if not isinstance(when, dict) or not isinstance(then, dict):
            continue
        rm = RuleMatch(
            glob=when.get("glob"),
            regex=when.get("regex"),
            ext_in=list(when.get("ext_in") or []) or None,
            name_includes=when.get("name_includes"),
            path_includes=when.get("path_includes"),
            contains_text=when.get("contains_text"),
            min_size_bytes=when.get("min_size_bytes"),
            max_size_bytes=when.get("max_size_bytes"),
            except_glob=list(when.get("except_glob") or []) or None,
        )
        ra = RuleAction(
            move_to=then.get("move_to"),
            copy_to=then.get("copy_to"),
            rename=then.get("rename"),
            skip_if_exists=bool(then.get("skip_if_exists", True)),
        )
        rules.append(Rule(name=name, when=rm, then=ra, priority=pr))
    rules.sort(key=lambda x: x.priority)
    return Ruleset(version=version, rules=rules)


def _glob_match(root: Path, rel: Path, pattern: str) -> bool:
    """
    Glob matching for rules.
    Notes:
      - Many people expect "**/*.ext" to match files in the root too; Python's matchers don't.
      - We treat a leading "**/" as optional.
    """
    import fnmatch

    s = rel.as_posix()
    if fnmatch.fnmatch(s, pattern):
        return True
    if pattern.startswith("**/"):
        return fnmatch.fnmatch(s, pattern[3:])
    return False


def _should_exclude(root: Path, rel: Path, patterns: Optional[List[str]]) -> bool:
    if not patterns:
        return False
    for pat in patterns:
        if _glob_match(root, rel, pat):
            return True
    return False


def _is_text_file(p: Path) -> bool:
    return p.suffix.lower() in TEXT_EXT_DEFAULT


def _read_text_safe(p: Path, max_bytes: int = 512 * 1024) -> Optional[str]:
    try:
        if p.stat().st_size > max_bytes:
            return None
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None


def _render_rename(template: str, src: Path) -> str:
    st = src.stat()
    from datetime import datetime

    dt = datetime.fromtimestamp(st.st_mtime)
    tokens = {
        "name": src.name,
        "stem": src.stem,
        "ext": src.suffix,
        "yyyy": f"{dt.year:04d}",
        "mm": f"{dt.month:02d}",
        "dd": f"{dt.day:02d}",
        "date": f"{dt.year:04d}-{dt.month:02d}-{dt.day:02d}",
    }
    out = template
    for k, v in tokens.items():
        out = out.replace("{" + k + "}", v)
    return out


def _match_rule(rule: Rule, root: Path, abs_path: Path, rel: Path) -> bool:
    w = rule.when
    if _should_exclude(root, rel, w.except_glob):
        return False
    if w.glob and not _glob_match(root, rel, w.glob):
        return False
    if w.regex:
        if not re.search(w.regex, rel.as_posix(), flags=re.IGNORECASE):
            return False
    if w.ext_in:
        exts = {e.lower() if e.startswith(".") else "." + e.lower() for e in w.ext_in}
        if abs_path.suffix.lower() not in exts:
            return False
    if w.name_includes and w.name_includes.lower() not in abs_path.name.lower():
        return False
    if w.path_includes and w.path_includes.lower() not in rel.as_posix().lower():
        return False
    try:
        size = abs_path.stat().st_size
    except Exception:
        return False
    if w.min_size_bytes is not None and size < int(w.min_size_bytes):
        return False
    if w.max_size_bytes is not None and size > int(w.max_size_bytes):
        return False
    if w.contains_text:
        if not _is_text_file(abs_path):
            return False
        text = _read_text_safe(abs_path)
        if text is None:
            return False
        if w.contains_text.lower() not in text.lower():
            return False
    return True


def _iter_files(root: Path, recursive: bool) -> Iterable[Tuple[Path, Path]]:
    # yields (abs, rel)
    if recursive:
        for p in root.rglob("*"):
            if p.is_file():
                yield p, p.relative_to(root)
    else:
        for p in root.iterdir():
            if p.is_file():
                yield p, p.relative_to(root)


def apply_ruleset(
    policy: PolicyConfig,
    root: Path,
    ruleset_path: Path,
    *,
    recursive: bool = True,
    dry_run: bool = True,
    max_ops: int = 10_000,
    undo: Optional[UndoJournal] = None,
) -> Dict[str, Any]:
    root = assert_path_allowed(policy, root)
    ruleset_path = assert_path_allowed(policy, ruleset_path)
    ruleset = load_ruleset(ruleset_path)

    ops: List[Dict[str, Any]] = []
    matched: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []
    total = 0

    for abs_p, rel in _iter_files(root, recursive=recursive):
        total += 1
        # enforce allowlist per file
        try:
            abs_p = assert_path_allowed(policy, abs_p)
        except PermissionError:
            continue

        applied = False
        for rule in ruleset.rules:
            if not _match_rule(rule, root, abs_p, rel):
                continue

            dest_dir = rule.then.move_to or rule.then.copy_to
            if not dest_dir:
                skipped.append(
                    {"path": str(abs_p), "rule": rule.name, "reason": "no_action"}
                )
                applied = True
                break

            dst_folder = assert_path_allowed(policy, (root / dest_dir))
            new_name = abs_p.name
            if rule.then.rename:
                new_name = _render_rename(str(rule.then.rename), abs_p)
            dst = dst_folder / new_name
            if rule.then.skip_if_exists and dst.exists():
                skipped.append(
                    {
                        "path": str(abs_p),
                        "rule": rule.name,
                        "reason": "dst_exists",
                        "dst": str(dst),
                    }
                )
                applied = True
                break

            # choose move or copy
            if rule.then.move_to:
                op = {"op": "move", "src": str(abs_p), "dst": str(dst)}
                ops.append(op)
                matched.append(
                    {
                        "path": str(abs_p),
                        "rule": rule.name,
                        "action": "move",
                        "dst": str(dst),
                    }
                )
                if not dry_run:
                    ensure_dir(dst.parent)
                    shutil.move(str(abs_p), str(dst))
                if undo is not None and not dry_run:
                    undo.append(op)
            else:
                op = {"op": "copy", "src": str(abs_p), "dst": str(dst)}
                ops.append(op)
                matched.append(
                    {
                        "path": str(abs_p),
                        "rule": rule.name,
                        "action": "copy",
                        "dst": str(dst),
                    }
                )
                if not dry_run:
                    ensure_dir(dst.parent)
                    if abs_p.is_dir():
                        shutil.copytree(abs_p, dst)
                    else:
                        shutil.copy2(str(abs_p), str(dst))
                if undo is not None and not dry_run:
                    undo.append(op)

            applied = True
            break

        if not applied:
            continue
        if len(ops) >= max_ops:
            break

    return {
        "ok": True,
        "ruleset": {
            "path": str(ruleset_path),
            "version": ruleset.version,
            "rules": len(ruleset.rules),
        },
        "root": str(root),
        "dry_run": bool(dry_run),
        "recursive": bool(recursive),
        "scanned": total,
        "ops": len(ops),
        "matched": matched[:2000],
        "skipped": skipped[:2000],
    }
