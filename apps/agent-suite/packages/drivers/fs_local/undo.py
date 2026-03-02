from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

from ...core.policy import PolicyConfig, assert_path_allowed
from ...core.utils import ensure_dir, now_iso


def _stable_id(payload: Dict[str, Any]) -> str:
    """Create a deterministic-ish id for a journal entry (timestamp + pid + hash)."""
    import hashlib

    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    h = hashlib.sha256(raw).hexdigest()[:16]
    return f"undo_{h}"


@dataclass
class UndoJournal:
    path: Path

    def __post_init__(self) -> None:
        ensure_dir(self.path.parent)

    def append(self, op: Dict[str, Any]) -> str:
        rec = {"ts": now_iso(), **op}
        rec["id"] = rec.get("id") or _stable_id(
            {"ts": rec["ts"], **op, "pid": os.getpid()}
        )
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        return str(rec["id"])

    def read_all(self) -> List[Dict[str, Any]]:
        if not self.path.exists():
            return []
        out: List[Dict[str, Any]] = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except Exception:
                    continue
        return out

    def tail(self, n: int) -> List[Dict[str, Any]]:
        if n <= 0:
            return []
        all_ops = self.read_all()
        return all_ops[-n:]


@dataclass(frozen=True)
class UndoResult:
    undone: int
    skipped: int
    details: List[Dict[str, Any]]


def _conflict_path(p: Path) -> Path:
    base = p.with_name(p.name + "__undo_conflict__")
    k = 1
    cand = base
    while cand.exists():
        cand = p.with_name(p.name + f"__undo_conflict__{k}")
        k += 1
    return cand


def _undo_one(
    policy: PolicyConfig, op: Dict[str, Any], dry_run: bool
) -> Tuple[bool, Dict[str, Any]]:
    """Return (ok, detail)."""
    kind = (op.get("op") or "").lower()

    def _p(v: str) -> Path:
        return assert_path_allowed(policy, Path(v))

    if kind == "move":
        src = _p(op["src"])
        dst = _p(op["dst"])
        detail: Dict[str, Any] = {"op": "move", "from": str(dst), "to": str(src)}
        if not dst.exists():
            detail["reason"] = "missing_dst"
            return False, detail
        if src.exists():
            detail["reason"] = "src_exists_conflict"
            return False, detail
        if not dry_run:
            ensure_dir(src.parent)
            dst.rename(src)
        return True, detail

    if kind == "rename":
        old = _p(op["old"])
        new = _p(op["new"])
        detail = {"op": "rename", "from": str(new), "to": str(old)}
        if not new.exists():
            detail["reason"] = "missing_new"
            return False, detail
        if old.exists():
            detail["reason"] = "old_exists_conflict"
            return False, detail
        if not dry_run:
            ensure_dir(old.parent)
            new.rename(old)
        return True, detail

    if kind == "copy":
        dst = _p(op["dst"])
        detail = {"op": "copy", "delete": str(dst)}
        if not dst.exists():
            detail["reason"] = "missing_dst"
            return False, detail
        if not dry_run:
            if dst.is_dir():
                import shutil

                shutil.rmtree(dst)
            else:
                dst.unlink()
        return True, detail

    if kind == "mkdir":
        path = _p(op["path"])
        detail = {"op": "mkdir", "rmdir": str(path)}
        if not path.exists() or not path.is_dir():
            detail["reason"] = "missing_dir"
            return False, detail
        # only remove if empty
        try:
            next(path.iterdir())
            detail["reason"] = "not_empty"
            return False, detail
        except StopIteration:
            pass
        if not dry_run:
            path.rmdir()
        return True, detail

    if kind == "batch":
        # undo batch items in reverse
        items = op.get("items") or []
        if not isinstance(items, list):
            return False, {"op": "batch", "reason": "bad_items"}
        ok_n = 0
        skip_n = 0
        item_details: List[Dict[str, Any]] = []
        for item in reversed(items):
            ok, d = _undo_one(policy, item, dry_run=dry_run)
            item_details.append(d)
            if ok:
                ok_n += 1
            else:
                skip_n += 1
        return ok_n > 0, {
            "op": "batch",
            "undone_items": ok_n,
            "skipped_items": skip_n,
            "items": item_details,
        }

    return False, {"op": kind or "unknown", "reason": "unknown_op"}


def undo_last(
    policy: PolicyConfig, journal: UndoJournal, steps: int = 1, dry_run: bool = True
) -> UndoResult:
    ops = journal.tail(steps)
    undone = 0
    skipped = 0
    details: List[Dict[str, Any]] = []
    for op in reversed(ops):
        ok, d = _undo_one(policy, op, dry_run=dry_run)
        details.append({"id": op.get("id"), **d})
        if ok:
            undone += 1
        else:
            skipped += 1
    return UndoResult(undone=undone, skipped=skipped, details=details)
