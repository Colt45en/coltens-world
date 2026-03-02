from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

from ...core.policy import PolicyConfig, assert_path_allowed
from ...core.utils import ensure_dir, now_iso


SAFE_SLUG_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def _slugify(title: str) -> str:
    title = (title or "").strip()
    if not title:
        title = "note"
    s = SAFE_SLUG_RE.sub("-", title).strip("-").lower()
    s = s[:80] if len(s) > 80 else s
    return s or "note"


@dataclass(frozen=True)
class NoteMeta:
    note_id: str
    title: str
    path: str
    created_utc: str
    updated_utc: str


def _notes_root(policy: PolicyConfig, repo_root: Path) -> Path:
    # notes live under allowed sandbox by default
    notes = (repo_root / "sandbox" / "notes").resolve()
    # must be allowed
    assert_path_allowed(policy, notes)
    ensure_dir(notes)
    return notes


def create_note(
    policy: PolicyConfig, repo_root: Path, title: str, body_md: str = ""
) -> NoteMeta:
    root = _notes_root(policy, repo_root)
    ts = now_iso().replace(":", "").replace("-", "")
    slug = _slugify(title)
    note_id = f"note_{slug}_{ts}"
    path = root / f"{note_id}.md"

    header = f"# {title.strip() if title.strip() else 'Note'}\n\n"
    meta = f"<!-- created_utc: {now_iso()} -->\n"
    content = header + meta + "\n" + (body_md.strip() + "\n" if body_md.strip() else "")
    path.write_text(content, encoding="utf-8")

    return NoteMeta(
        note_id=note_id,
        title=title.strip() if title.strip() else "Note",
        path=str(path),
        created_utc=now_iso(),
        updated_utc=now_iso(),
    )


def append_note(
    policy: PolicyConfig, repo_root: Path, note_id: str, body_md: str
) -> NoteMeta:
    root = _notes_root(policy, repo_root)
    path = root / f"{note_id}.md"
    path = assert_path_allowed(policy, path)
    if not path.exists():
        raise FileNotFoundError(f"Note not found: {note_id}")

    existing = path.read_text(encoding="utf-8")
    chunk = body_md.rstrip() + "\n"
    updated = existing.rstrip() + "\n\n" + chunk
    path.write_text(updated, encoding="utf-8")

    # best-effort title from first markdown header
    title = "Note"
    for line in existing.splitlines():
        if line.startswith("# "):
            title = line[2:].strip() or "Note"
            break

    return NoteMeta(
        note_id=note_id,
        title=title,
        path=str(path),
        created_utc="",  # not tracked here
        updated_utc=now_iso(),
    )


def list_notes(policy: PolicyConfig, repo_root: Path) -> List[NoteMeta]:
    root = _notes_root(policy, repo_root)
    out: List[NoteMeta] = []
    for p in sorted(root.glob("note_*.md")):
        p = assert_path_allowed(policy, p)
        title = p.stem
        try:
            txt = p.read_text(encoding="utf-8")
            for line in txt.splitlines():
                if line.startswith("# "):
                    title = line[2:].strip() or title
                    break
        except Exception:
            pass
        out.append(
            NoteMeta(
                note_id=p.stem,
                title=title,
                path=str(p),
                created_utc="",
                updated_utc="",
            )
        )
    return out


def read_note(
    policy: PolicyConfig, repo_root: Path, note_id: str
) -> Tuple[NoteMeta, str]:
    root = _notes_root(policy, repo_root)
    path = root / f"{note_id}.md"
    path = assert_path_allowed(policy, path)
    if not path.exists():
        raise FileNotFoundError(f"Note not found: {note_id}")
    txt = path.read_text(encoding="utf-8")

    title = note_id
    for line in txt.splitlines():
        if line.startswith("# "):
            title = line[2:].strip() or title
            break

    meta = NoteMeta(
        note_id=note_id, title=title, path=str(path), created_utc="", updated_utc=""
    )
    return meta, txt
