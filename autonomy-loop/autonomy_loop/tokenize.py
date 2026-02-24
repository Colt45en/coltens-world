"""Tokenization: extract words and code symbols."""

from __future__ import annotations
import re
from typing import Iterable


_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'\-]*")
_SYMBOL_RE = re.compile(r"[A-Za-z_]\w*|==|!=|<=|>=|=>|->|::|[{}()\[\];,.:=+\-*/<>]")


def extract_words(text: str) -> list[str]:
    """Extract English-like words."""
    return [m.group(0) for m in _WORD_RE.finditer(text)]


def extract_code_symbols(text: str) -> list[str]:
    """Extract code symbols: identifiers + operators."""
    return [m.group(0) for m in _SYMBOL_RE.finditer(text)]


def stable_sorted(items: Iterable[str]) -> list[str]:
    """Deterministically sort items (lowercase, then natural case)."""
    return sorted(items, key=lambda s: (s.lower(), s))
