from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ...core.policy import PolicyConfig, assert_path_allowed


@dataclass(frozen=True)
class FileSummary:
    path: str
    chars: int
    preview: str


def read_text_preview(
    policy: PolicyConfig, path: Path, max_chars: int = 4000
) -> FileSummary:
    path = assert_path_allowed(policy, path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"File not found: {path}")

    # Only read as utf-8. Keep it safe + predictable.
    txt = path.read_text(encoding="utf-8", errors="strict")
    preview = txt[:max_chars]
    return FileSummary(path=str(path), chars=len(txt), preview=preview)
