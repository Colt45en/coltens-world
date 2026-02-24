"""Merge policies for deduplication governance."""

from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class MergePolicy:
    """
    Versioned merge policy for handling collisions.

    Defines how two entries with conflicting stable keys are resolved:
    - fork_on_collision: reject collisions (safe but creates duplicates)
    - merge_if_same_trace: merge if from same batch/source
    - override_never: never allow overrides (strict)
    """
    version: str = "1.0.0"
    strategy: str = "fork_on_collision"

    # Lexicon key: (language, term)
    # Rune key: (code_language, symbol, process_tag)
