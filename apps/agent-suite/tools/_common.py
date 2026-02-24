from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator

CANONICAL_JSON_KWARGS = {"separators": (",", ":"), "sort_keys": True, "ensure_ascii": False}


def ensure_agent_suite_on_path() -> None:
    root = Path(__file__).resolve().parents[1]  # apps/agent-suite
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


def iter_jsonl(path: str) -> Iterator[Dict[str, Any]]:
    with open(path, "rt", encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            s = line.strip()
            if not s:
                continue
            try:
                yield json.loads(s)
            except Exception as e:
                raise ValueError(f"Invalid JSON on line {i} in {path}: {e}") from e


def write_jsonl(path: str, records: Iterable[Dict[str, Any]]) -> None:
    with open(path, "wt", encoding="utf-8", newline="\n") as f:
        for rec in records:
            f.write(json.dumps(rec, **CANONICAL_JSON_KWARGS) + "\n")
