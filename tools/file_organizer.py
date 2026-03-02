#!/usr/bin/env python3
from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, cast

import jsonschema

# ----------------------------
# Tamper-evident audit (hash chain)
# ----------------------------


def canonical_json(obj: Dict[str, Any]) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


class AuditChain:
    def __init__(self, log_path: Path):
        self.log_path = log_path
        self.head_path = log_path.with_suffix(log_path.suffix + ".head")
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def _read_head(self) -> str:
        if self.head_path.exists():
            t = self.head_path.read_text(encoding="utf-8").strip()
            return t or "GENESIS"
        return "GENESIS"

    def _write_head(self, h: str) -> None:
        self.head_path.write_text(h, encoding="utf-8")

    def append(self, event: Dict[str, Any]) -> Dict[str, Any]:
        event = dict(event)
        event.setdefault("ts_unix", time.time())

        prev = self._read_head()
        unsigned = dict(event)
        unsigned.pop("hash", None)
        unsigned.pop("prev_hash", None)

        unsigned_str = canonical_json(unsigned)
        h = sha256_hex(prev + "\n" + unsigned_str)

        full = dict(unsigned)
        full["prev_hash"] = prev
        full["hash"] = h

        line = canonical_json(full)
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
            f.flush()

        self._write_head(h)
        return full


# ----------------------------
# Helpers
# ----------------------------


def is_abs_path(p: str) -> bool:
    try:
        return Path(p).is_absolute()
    except Exception:
        return False


def within(root: Path, target: Path) -> bool:
    root = root.resolve()
    target = target.resolve()
    return root == target or root in target.parents


def file_age_days(p: Path) -> float:
    st = p.stat()
    age_s = time.time() - st.st_mtime
    return age_s / 86400.0


def file_size_kb(p: Path) -> float:
    return p.stat().st_size / 1024.0


def read_text_safe(p: Path, max_bytes: int = 2_000_000) -> Optional[str]:
    # Only for "text-ish" files; keep bounded
    try:
        if p.stat().st_size > max_bytes:
            return None
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None


def render_template(tpl: str, src: Path) -> str:
    name = src.stem
    ext = src.suffix
    date = datetime.fromtimestamp(src.stat().st_mtime).strftime("%Y-%m-%d")
    size = str(int(src.stat().st_size))
    return tpl.format(name=name, ext=ext, date=date, size=size)


# ----------------------------
# Rule evaluation
# ----------------------------


@dataclass
class Rule:
    pattern: str
    action: str
    destination: Optional[str]
    template: Optional[str]
    create_folders: bool
    condition: Dict[str, Any]


def rule_matches(rule: Rule, path: Path) -> Tuple[bool, str]:
    # Glob match against file name (common expectation)
    if not fnmatch.fnmatch(path.name, rule.pattern):
        return False, "pattern_no_match"

    c = rule.condition or {}

    # Age gates
    if "min_age_days" in c:
        if file_age_days(path) < float(c["min_age_days"]):
            return False, "min_age_days_no_match"
    if "max_age_days" in c:
        if file_age_days(path) > float(c["max_age_days"]):
            return False, "max_age_days_no_match"

    # Size gate
    if "min_size_kb" in c:
        if file_size_kb(path) < float(c["min_size_kb"]):
            return False, "min_size_kb_no_match"

    # Content gates (only for readable text)
    contains = c.get("contains_text")
    not_contains = c.get("not_contains_text")
    if contains or not_contains:
        txt = read_text_safe(path)
        if txt is None:
            return False, "text_unreadable"
        if contains and contains not in txt:
            return False, "contains_text_no_match"
        if not_contains and not_contains in txt:
            return False, "not_contains_text_no_match"

    return True, "match"


# ----------------------------
# Actions
# ----------------------------


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def do_move(src: Path, dest_dir: Path, create: bool) -> Path:
    if create:
        ensure_dir(dest_dir)
    dest = dest_dir / src.name
    return Path(shutil.move(str(src), str(dest)))


def do_copy(src: Path, dest_dir: Path, create: bool) -> Path:
    if create:
        ensure_dir(dest_dir)
    dest = dest_dir / src.name
    shutil.copy2(str(src), str(dest))
    return dest


def do_delete(src: Path) -> None:
    src.unlink()


def do_rename(src: Path, new_name: str) -> Path:
    dest = src.with_name(new_name)
    return src.rename(dest)


# ----------------------------
# Main
# ----------------------------


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--schema", required=True, help="Path to JSON schema (draft-07)")
    ap.add_argument("--ruleset", required=True, help="Path to ruleset JSON")
    ap.add_argument(
        "--sandbox-root", required=True, help="Absolute root allowed to be touched"
    )
    ap.add_argument(
        "--apply",
        action="store_true",
        help="Actually perform actions (otherwise dry-run)",
    )
    ap.add_argument(
        "--approve",
        action="store_true",
        help="Approve destructive/out-of-sandbox operations",
    )
    ap.add_argument(
        "--audit",
        default=".audit/file-organizer.ndjson",
        help="Audit log path (NDJSON chained)",
    )
    args = ap.parse_args()

    schema_path = Path(args.schema).resolve()
    ruleset_path = Path(args.ruleset).resolve()
    sandbox_root = Path(args.sandbox_root).resolve()
    audit_path = Path(args.audit).resolve()

    if not sandbox_root.is_absolute():
        print("sandbox-root must be an absolute path", file=sys.stderr)
        return 2

    # Load schema + ruleset
    schema: Dict[str, Any] = json.loads(schema_path.read_text(encoding="utf-8"))
    ruleset: Dict[str, Any] = json.loads(ruleset_path.read_text(encoding="utf-8"))

    # Validate
    jsonschema.validate(instance=ruleset, schema=schema)

    target_folder = Path(ruleset["target_folder"]).resolve()
    if not target_folder.is_absolute():
        raise SystemExit("ruleset.target_folder must be an absolute path")

    # Sandbox enforcement
    if not within(sandbox_root, target_folder):
        raise SystemExit(
            f"target_folder {target_folder} is outside sandbox_root {sandbox_root}"
        )

    audit = AuditChain(audit_path)
    audit.append(
        {
            "kind": "run.start",
            "apply": bool(args.apply),
            "approve": bool(args.approve),
            "sandbox_root": str(sandbox_root),
            "target_folder": str(target_folder),
            "ruleset_name": ruleset.get("name"),
        }
    )

    # Compile rules
    compiled: List[Rule] = []
    for r in ruleset["rules"]:
        compiled.append(
            Rule(
                pattern=r["pattern"],
                action=r["action"],
                destination=r.get("destination"),
                template=r.get("template"),
                create_folders=bool(r.get("create_folders", True)),
                condition=r.get("condition") or {},
            )
        )

    # Walk files
    candidates: List[Path] = []
    for p in target_folder.rglob("*"):
        if p.is_file():
            candidates.append(p)

    # Apply rules in order; first matching rule wins
    changes = 0
    for src in candidates:
        rel = str(src.relative_to(target_folder))
        matched_rule: Optional[Rule] = None
        match_reason = ""
        for rule in compiled:
            ok, reason = rule_matches(rule, src)
            if ok:
                matched_rule = rule
                match_reason = reason
                break

        if not matched_rule:
            continue

        rule = matched_rule
        action = rule.action

        # Determine destinations / rename
        dest_path: Optional[Path] = None
        rename_to: Optional[str] = None

        if action in {"move", "copy"}:
            dest_raw = rule.destination or ""
            dest_dir = Path(dest_raw)
            if not dest_dir.is_absolute():
                # Interpret relative destinations relative to target_folder
                dest_dir = (target_folder / dest_dir).resolve()
            else:
                dest_dir = dest_dir.resolve()

            dest_path = dest_dir / src.name

        if action == "rename":
            if not rule.template:
                continue
            rename_to = render_template(rule.template, src)

        # Approvals policy: delete always requires approve flag; move/copy outside sandbox requires approve.
        needs_approval = False
        why = None

        if action == "delete":
            needs_approval = True
            why = "delete_requires_approval"

        if action in {"move", "copy"} and dest_path is not None:
            if not within(sandbox_root, dest_path):
                needs_approval = True
                why = "destination_outside_sandbox"

        # Write audit intent
        audit.append(
            {
                "kind": "rule.match",
                "file": str(src),
                "file_rel": rel,
                "pattern": rule.pattern,
                "action": action,
                "match_reason": match_reason,
                "destination": str(dest_path) if dest_path else None,
                "rename_to": rename_to,
                "needs_approval": needs_approval,
                "approval_reason": why,
                "dry_run": not args.apply,
            }
        )

        if needs_approval and not args.approve:
            continue

        if not args.apply:
            continue

        # Execute
        try:
            if action == "move" and dest_path is not None:
                out = do_move(src, dest_path.parent, rule.create_folders)
                audit.append(
                    {
                        "kind": "action.move",
                        "src": str(src),
                        "dst": str(out),
                        "ok": True,
                    }
                )
                changes += 1

            elif action == "copy" and dest_path is not None:
                out = do_copy(src, dest_path.parent, rule.create_folders)
                audit.append(
                    {
                        "kind": "action.copy",
                        "src": str(src),
                        "dst": str(out),
                        "ok": True,
                    }
                )
                changes += 1

            elif action == "delete":
                do_delete(src)
                audit.append({"kind": "action.delete", "src": str(src), "ok": True})
                changes += 1

            elif action == "rename" and rename_to is not None:
                out = do_rename(src, rename_to)
                audit.append(
                    {
                        "kind": "action.rename",
                        "src": str(src),
                        "dst": str(out),
                        "ok": True,
                    }
                )
                changes += 1

        except Exception as e:
            audit.append(
                {
                    "kind": f"action.{action}.error",
                    "src": str(src),
                    "dst": str(dest_path) if dest_path else None,
                    "error": f"{type(e).__name__}: {e}",
                    "ok": False,
                }
            )

    # Post actions (run at end)
    for pa in cast(List[Dict[str, Any]], ruleset.get("post_actions", []) or []):
        t = cast(str, pa["type"])
        audit.append({"kind": "post_action.begin", "type": t, "payload": pa})

        if not args.apply:
            audit.append({"kind": "post_action.skipped_dry_run", "type": t})
            continue

        try:
            if t in {"create_index", "create_note"}:
                out_path = Path(pa["path"])
                if not out_path.is_absolute():
                    out_path = (target_folder / out_path).resolve()

                if not within(sandbox_root, out_path):
                    # never write outside sandbox unless approved
                    if not args.approve:
                        audit.append(
                            {
                                "kind": "post_action.blocked",
                                "type": t,
                                "reason": "out_of_sandbox",
                                "path": str(out_path),
                            }
                        )
                        continue

                ensure_dir(out_path.parent)
                content = pa.get("content", "")
                title = pa.get("title", "")
                if t == "create_note":
                    body = f"# {title}\n\n{content}\n"
                else:
                    body = content

                out_path.write_text(body, encoding="utf-8")
                audit.append(
                    {
                        "kind": "post_action.write",
                        "type": t,
                        "path": str(out_path),
                        "ok": True,
                    }
                )

            elif t == "run_command":
                cmd = pa["command"]
                # Safe by default: only run if approved (commands can be dangerous)
                if not args.approve:
                    audit.append(
                        {
                            "kind": "post_action.blocked",
                            "type": t,
                            "reason": "command_requires_approval",
                            "command": cmd,
                        }
                    )
                    continue

                cp = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                audit.append(
                    {
                        "kind": "post_action.command",
                        "type": t,
                        "command": cmd,
                        "returncode": cp.returncode,
                        "stdout": cp.stdout[-2000:],
                        "stderr": cp.stderr[-2000:],
                        "ok": cp.returncode == 0,
                    }
                )
        except Exception as e:
            audit.append(
                {
                    "kind": "post_action.error",
                    "type": t,
                    "error": f"{type(e).__name__}: {e}",
                    "ok": False,
                }
            )

    audit.append({"kind": "run.done", "changes": changes})
    print(f"OK. changes={changes} dry_run={not args.apply} audit={audit_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except jsonschema.ValidationError as e:
        print("Ruleset validation failed:", e.message, file=sys.stderr)
        raise
