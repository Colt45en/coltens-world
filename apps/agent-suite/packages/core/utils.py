from __future__ import annotations

import os
import platform
import subprocess
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse


def now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def is_subpath(path: Path, root: Path) -> bool:
    try:
        path_r = path.resolve()
        root_r = root.resolve()
    except Exception:
        path_r = path.absolute()
        root_r = root.absolute()

    rp = root_r.parts
    pp = path_r.parts
    return len(pp) >= len(rp) and pp[:len(rp)] == rp


def open_with_default_app(path: Path) -> None:
    system = platform.system().lower()
    if system.startswith("windows"):
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif system == "darwin":
        subprocess.run(["open", str(path)], check=True)
    else:
        subprocess.run(["xdg-open", str(path)], check=True)


def domain_of(url: str) -> str:
    p = urlparse(url)
    return (p.hostname or "").lower()


def normalize_domains(domains: Iterable[str]) -> set[str]:
    out: set[str] = set()
    for d in domains:
        d = (d or "").strip().lower()
        if not d:
            continue
        if d.startswith("http://") or d.startswith("https://"):
            d = domain_of(d)
        out.add(d)
    return out
