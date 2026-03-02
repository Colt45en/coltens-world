from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from ...core.policy import PolicyConfig, assert_path_allowed
from ...core.utils import ensure_dir
from .undo import UndoJournal


def list_dir(
    policy: PolicyConfig,
    directory: Path,
    *,
    recursive: bool = False,
    max_items: int = 5000,
) -> List[Dict[str, Any]]:
    directory = assert_path_allowed(policy, directory)
    out: List[Dict[str, Any]] = []
    if not directory.exists():
        return out

    def _emit(p: Path) -> None:
        try:
            st = p.stat()
            out.append(
                {
                    "path": str(p),
                    "rel": str(p.relative_to(directory)),
                    "type": "dir" if p.is_dir() else "file",
                    "size": st.st_size,
                    "mtime": st.st_mtime,
                }
            )
        except Exception:
            out.append(
                {
                    "path": str(p),
                    "rel": str(p.relative_to(directory)),
                    "type": "dir" if p.is_dir() else "file",
                }
            )

    if recursive:
        for p in directory.rglob("*"):
            if len(out) >= max_items:
                break
            _emit(p)
    else:
        for p in directory.iterdir():
            if len(out) >= max_items:
                break
            _emit(p)

    return out


def _iter_files(root: Path, recursive: bool = True):
    if recursive:
        for p in root.rglob("*"):
            if p.is_file():
                yield p
    else:
        for p in root.iterdir():
            if p.is_file():
                yield p


def find_by_name(
    policy: PolicyConfig,
    directory: Path,
    pattern: str,
    *,
    recursive: bool = True,
    max_hits: int = 500,
) -> List[str]:
    directory = assert_path_allowed(policy, directory)
    rx = re.compile(pattern, flags=re.IGNORECASE)
    hits: List[str] = []
    for p in _iter_files(directory, recursive=recursive):
        if len(hits) >= max_hits:
            break
        if rx.search(p.name):
            hits.append(str(p))
    return hits


def find_by_content(
    policy: PolicyConfig,
    directory: Path,
    pattern: str,
    *,
    recursive: bool = True,
    max_hits: int = 200,
) -> List[Dict[str, Any]]:
    directory = assert_path_allowed(policy, directory)
    rx = re.compile(pattern, flags=re.IGNORECASE)
    hits: List[Dict[str, Any]] = []

    for p in _iter_files(directory, recursive=recursive):
        if len(hits) >= max_hits:
            break
        # keep this conservative: scan text-ish files under 1MB
        try:
            if p.stat().st_size > 1_000_000:
                continue
        except Exception:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        m = rx.search(text)
        if m:
            snippet = text[max(0, m.start() - 80) : m.end() + 80].replace("\n", " ")
            hits.append({"path": str(p), "match": snippet[:240]})
    return hits


def read_text_file(
    policy: PolicyConfig, path: Path, *, max_bytes: int = 256_000
) -> str:
    path = assert_path_allowed(policy, path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(str(path))
    if path.stat().st_size > max_bytes:
        raise ValueError(f"File too large to read as text (>{max_bytes} bytes): {path}")
    return path.read_text(encoding="utf-8", errors="ignore")


def move_path(
    policy: PolicyConfig,
    src: Path,
    dst: Path,
    *,
    overwrite: bool = False,
    undo: Optional[UndoJournal] = None,
) -> Dict[str, Any]:
    src = assert_path_allowed(policy, src)
    dst = assert_path_allowed(policy, dst)
    if not src.exists():
        raise FileNotFoundError(str(src))
    if dst.exists() and not overwrite:
        raise FileExistsError(str(dst))

    ensure_dir(dst.parent)
    if dst.exists() and overwrite:
        if dst.is_dir():
            shutil.rmtree(dst)
        else:
            dst.unlink()

    if undo is not None:
        undo.append({"op": "move", "src": str(src), "dst": str(dst)})

    shutil.move(str(src), str(dst))
    return {"ok": True, "src": str(src), "dst": str(dst)}


def copy_path(
    policy: PolicyConfig,
    src: Path,
    dst: Path,
    *,
    overwrite: bool = False,
    undo: Optional[UndoJournal] = None,
) -> Dict[str, Any]:
    src = assert_path_allowed(policy, src)
    dst = assert_path_allowed(policy, dst)
    if not src.exists():
        raise FileNotFoundError(str(src))
    if dst.exists() and not overwrite:
        raise FileExistsError(str(dst))

    ensure_dir(dst.parent)
    if dst.exists() and overwrite:
        if dst.is_dir():
            shutil.rmtree(dst)
        else:
            dst.unlink()

    if src.is_dir():
        shutil.copytree(src, dst)
    else:
        shutil.copy2(src, dst)

    if undo is not None:
        undo.append({"op": "copy", "src": str(src), "dst": str(dst)})

    return {"ok": True, "src": str(src), "dst": str(dst)}


def mkdir(
    policy: PolicyConfig,
    path: Path,
    *,
    exist_ok: bool = True,
    undo: Optional[UndoJournal] = None,
) -> Dict[str, Any]:
    path = assert_path_allowed(policy, path)
    existed = path.exists()
    path.mkdir(parents=True, exist_ok=exist_ok)
    if undo is not None and not existed:
        undo.append({"op": "mkdir", "path": str(path)})
    return {"ok": True, "path": str(path), "existed": existed}


def rename_path(
    policy: PolicyConfig,
    src: Path,
    new_name: str,
    *,
    overwrite: bool = False,
    undo: Optional[UndoJournal] = None,
) -> Dict[str, Any]:
    src = assert_path_allowed(policy, src)
    if not src.exists():
        raise FileNotFoundError(str(src))
    dst = assert_path_allowed(policy, src.parent / new_name)
    if dst.exists() and not overwrite:
        raise FileExistsError(str(dst))

    ensure_dir(dst.parent)
    if dst.exists() and overwrite:
        if dst.is_dir():
            shutil.rmtree(dst)
        else:
            dst.unlink()

    if undo is not None:
        undo.append({"op": "rename", "old": str(src), "new": str(dst)})

    src.rename(dst)
    return {"ok": True, "old": str(src), "new": str(dst)}


def organize_by_extension(
    policy: PolicyConfig,
    directory: Path,
    *,
    recursive: bool = False,
    dry_run: bool = True,
    max_ops: int = 10_000,
    undo: Optional[UndoJournal] = None,
) -> Dict[str, Any]:
    directory = assert_path_allowed(policy, directory)
    if not directory.exists():
        raise FileNotFoundError(str(directory))

    ops: List[Dict[str, Any]] = []
    moved = 0
    skipped = 0

    files = list(_iter_files(directory, recursive=recursive))
    for p in files:
        if len(ops) >= max_ops:
            break
        ext = (p.suffix or "noext").lstrip(".").lower()
        dest_dir = directory / ext
        dst = dest_dir / p.name
        if dst.exists():
            skipped += 1
            continue
        ops.append({"op": "move", "src": str(p), "dst": str(dst)})
        moved += 1
        if not dry_run:
            ensure_dir(dest_dir)
            shutil.move(str(p), str(dst))

    if undo is not None and ops and not dry_run:
        undo.append({"op": "batch", "items": ops})

    return {
        "ok": True,
        "dry_run": bool(dry_run),
        "directory": str(directory),
        "moved": moved,
        "skipped": skipped,
        "ops": ops[:2000],
    }
