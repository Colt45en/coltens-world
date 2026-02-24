from __future__ import annotations

import fnmatch
import json
import shutil
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import jsonschema


# ----------------------------
# Utilities
# ----------------------------

def canonical_json(obj: Dict[str, Any]) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def within(root: Path, target: Path) -> bool:
    root = root.resolve()
    target = target.resolve()
    return root == target or root in target.parents

def file_age_days(p: Path) -> float:
    st = p.stat()
    return (time.time() - st.st_mtime) / 86400.0

def file_size_kb(p: Path) -> float:
    return p.stat().st_size / 1024.0

def read_text_safe(p: Path, max_bytes: int = 2_000_000) -> Optional[str]:
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

def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


# ----------------------------
# Rule types
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
    if not fnmatch.fnmatch(path.name, rule.pattern):
        return False, "pattern_no_match"

    c = rule.condition or {}

    if "min_age_days" in c and file_age_days(path) < float(c["min_age_days"]):
        return False, "min_age_days_no_match"
    if "max_age_days" in c and file_age_days(path) > float(c["max_age_days"]):
        return False, "max_age_days_no_match"
    if "min_size_kb" in c and file_size_kb(path) < float(c["min_size_kb"]):
        return False, "min_size_kb_no_match"

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
# Plan format
# ----------------------------

def _resolve_dest_dir(target_folder: Path, dest_raw: str) -> Path:
    d = Path(dest_raw)
    if not d.is_absolute():
        return (target_folder / d).resolve()
    return d.resolve()

def build_plan(
    *,
    schema_path: Path,
    ruleset_path: Path,
    sandbox_root: Path,
) -> Dict[str, Any]:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    ruleset = json.loads(ruleset_path.read_text(encoding="utf-8"))

    jsonschema.validate(instance=ruleset, schema=schema)

    target_folder = Path(ruleset["target_folder"]).resolve()
    if not target_folder.is_absolute():
        raise ValueError("ruleset.target_folder must be an absolute path")
    if not within(sandbox_root, target_folder):
        raise ValueError(f"target_folder outside sandbox_root: {target_folder} !<= {sandbox_root}")

    rules: List[Rule] = []
    for r in ruleset["rules"]:
        rules.append(Rule(
            pattern=r["pattern"],
            action=r["action"],
            destination=r.get("destination"),
            template=r.get("template"),
            create_folders=bool(r.get("create_folders", True)),
            condition=r.get("condition") or {},
        ))

    actions: List[Dict[str, Any]] = []
    total_files = 0

    for p in target_folder.rglob("*"):
        if not p.is_file():
            continue
        total_files += 1

        matched: Optional[Rule] = None
        match_reason = ""
        for rule in rules:
            ok, reason = rule_matches(rule, p)
            if ok:
                matched = rule
                match_reason = reason
                break
        if not matched:
            continue

        rule = matched
        action_kind = rule.action
        dest: Optional[str] = None
        rename_to: Optional[str] = None

        if action_kind in {"move", "copy"}:
            if not rule.destination:
                continue
            dest_dir = _resolve_dest_dir(target_folder, rule.destination)
            dest_path = (dest_dir / p.name).resolve()
            dest = str(dest_path)

        if action_kind == "rename":
            if not rule.template:
                continue
            rename_to = render_template(rule.template, p)

        # Risk classification (for approvals)
        needs_approval = False
        approval_reason = None

        if action_kind == "delete":
            needs_approval = True
            approval_reason = "delete_requires_approval"

        if action_kind in {"move", "copy"} and dest:
            if not within(sandbox_root, Path(dest)):
                needs_approval = True
                approval_reason = "destination_outside_sandbox"

        actions.append({
            "src": str(p),
            "action": action_kind,
            "pattern": rule.pattern,
            "match_reason": match_reason,
            "destination": dest,
            "rename_to": rename_to,
            "create_folders": rule.create_folders,
            "needs_approval": needs_approval,
            "approval_reason": approval_reason,
        })

    # Post actions risk (commands always approval; out-of-sandbox writes approval)
    post = ruleset.get("post_actions") or []
    post_actions: List[Dict[str, Any]] = []
    for pa in post:
        t = pa.get("type")
        needs_approval = False
        approval_reason = None

        if t == "run_command":
            needs_approval = True
            approval_reason = "run_command_requires_approval"

        if t in {"create_index", "create_note"}:
            out_path = Path(pa["path"])
            if not out_path.is_absolute():
                out_path = (target_folder / out_path).resolve()
            if not within(sandbox_root, out_path):
                needs_approval = True
                approval_reason = "post_write_outside_sandbox"

        post_actions.append({
            "type": t,
            "payload": pa,
            "needs_approval": needs_approval,
            "approval_reason": approval_reason,
        })

    risky = any(a["needs_approval"] for a in actions) or any(p["needs_approval"] for p in post_actions)

    summary = {
        "ruleset_name": ruleset.get("name"),
        "target_folder": str(target_folder),
        "sandbox_root": str(sandbox_root),
        "total_files_scanned": total_files,
        "total_matches": len(actions),
        "total_risky": sum(1 for a in actions if a["needs_approval"]) + sum(1 for p in post_actions if p["needs_approval"]),
        "requires_approval_to_apply": risky,
    }

    return {
        "summary": summary,
        "actions": actions,
        "post_actions": post_actions,
        "ruleset": ruleset,  # useful for apply phase
    }

def apply_plan(
    *,
    plan: Dict[str, Any],
    sandbox_root: Path,
    allow_risky: bool,
) -> Dict[str, Any]:
    """
    Executes the plan. If allow_risky=False, skips risky items.
    """
    applied = 0
    skipped = 0
    errors: List[Dict[str, Any]] = []

    # Execute file actions
    for a in plan["actions"]:
        if a["needs_approval"] and not allow_risky:
            skipped += 1
            continue

        src = Path(a["src"])
        kind = a["action"]

        try:
            if kind in {"move", "copy"}:
                dest = Path(a["destination"]).resolve()
                if not within(sandbox_root, dest) and not allow_risky:
                    skipped += 1
                    continue
                if a.get("create_folders", True):
                    ensure_dir(dest.parent)
                if kind == "move":
                    shutil.move(str(src), str(dest))
                else:
                    shutil.copy2(str(src), str(dest))
                applied += 1

            elif kind == "delete":
                src.unlink()
                applied += 1

            elif kind == "rename":
                new_name = a["rename_to"]
                if not new_name:
                    skipped += 1
                    continue
                src.rename(src.with_name(new_name))
                applied += 1

            else:
                skipped += 1

        except Exception as e:
            errors.append({"src": a["src"], "action": kind, "error": f"{type(e).__name__}: {e}"})

    # Post actions
    for p in plan["post_actions"]:
        if p["needs_approval"] and not allow_risky:
            skipped += 1
            continue

        t = p["type"]
        payload = p["payload"]

        try:
            if t in {"create_index", "create_note"}:
                # target folder is in ruleset
                target_folder = Path(plan["ruleset"]["target_folder"]).resolve()
                out_path = Path(payload["path"])
                if not out_path.is_absolute():
                    out_path = (target_folder / out_path).resolve()

                if not within(sandbox_root, out_path) and not allow_risky:
                    skipped += 1
                    continue

                ensure_dir(out_path.parent)
                content = payload.get("content", "")
                title = payload.get("title", "")
                body = f"# {title}\n\n{content}\n" if t == "create_note" else content
                out_path.write_text(body, encoding="utf-8")
                applied += 1

            elif t == "run_command":
                cmd = payload["command"]
                if not allow_risky:
                    skipped += 1
                    continue
                cp = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                if cp.returncode != 0:
                    errors.append({"action": "run_command", "command": cmd, "error": cp.stderr[-2000:]})
                applied += 1

        except Exception as e:
            errors.append({"action": "post_action", "type": t, "error": f"{type(e).__name__}: {e}"})

    return {"applied": applied, "skipped": skipped, "errors": errors}
