from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, List, Tuple


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stable_json_dumps(obj: Any) -> str:
    """
    Deterministic JSON: sorted keys, compact separators, stable floats/ints.
    """
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def content_hash_for(obj: Any) -> str:
    """
    Hash of stable JSON encoding. Truncated to 12 for readability (still deterministic).
    """
    j = stable_json_dumps(obj).encode("utf-8")
    return sha256_hex(j)[:12]


def stable_id(prefix: str, content_key: str, length: int = 10) -> str:
    """
    Deterministic stable ID from content key.
    """
    h = sha256_hex(content_key.encode("utf-8"))[:length]
    return f"{prefix}-{h}"


def normalize_whitespace(s: str) -> str:
    return " ".join(s.split())


def read_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_json(path: str, obj: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(stable_json_dumps(obj))
        f.write("\n")


def ensure_dir(path: str) -> None:
    import os
    os.makedirs(path, exist_ok=True)


@dataclass(frozen=True)
class SourceRef:
    file_path: str
    line_start: int
    line_end: int

    def to_str(self) -> str:
        if self.line_start == self.line_end:
            return f"{self.file_path}:L{self.line_start}"
        return f"{self.file_path}:L{self.line_start}-L{self.line_end}"


def lines_with_numbers(text: str) -> List[Tuple[int, str]]:
    return [(i + 1, line) for i, line in enumerate(text.splitlines())]


def clamp01(x: float) -> float:
    if x < 0.0:
        return 0.0
    if x > 1.0:
        return 1.0
    return x
