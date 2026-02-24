from __future__ import annotations

import glob
from dataclasses import dataclass
from pathlib import Path
from typing import List

from ...core.policy import PolicyConfig, assert_path_allowed
from ...core.utils import open_with_default_app


@dataclass
class LatestMatch:
    root: str
    pattern: str
    path: str
    mtime: float


def list_dir(policy: PolicyConfig, path: Path) -> List[str]:
    path = assert_path_allowed(policy, path)
    if not path.exists():
        raise FileNotFoundError(f"Path not found: {path}")
    if not path.is_dir():
        raise NotADirectoryError(f"Not a directory: {path}")
    return sorted([p.name for p in path.iterdir()])


def latest_matching(policy: PolicyConfig, root: Path, pattern: str) -> LatestMatch:
    root = assert_path_allowed(policy, root)
    if not root.exists():
        raise FileNotFoundError(f"Root dir not found: {root}")

    matches = [Path(p) for p in glob.glob(str(root / pattern), recursive=True)]
    # enforce allowlist on each candidate
    allowed = []
    for m in matches:
        try:
            mp = assert_path_allowed(policy, m)
            if mp.exists() and mp.is_file():
                allowed.append(mp)
        except PermissionError:
            continue

    if not allowed:
        raise FileNotFoundError(f"No files match pattern={pattern} under root={root}")

    allowed.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    top = allowed[0]
    return LatestMatch(
        root=str(root),
        pattern=pattern,
        path=str(top),
        mtime=float(top.stat().st_mtime),
    )


def open_path(policy: PolicyConfig, path: Path) -> str:
    path = assert_path_allowed(policy, path)
    if not path.exists():
        raise FileNotFoundError(f"Path not found: {path}")
    open_with_default_app(path)
    return str(path)
