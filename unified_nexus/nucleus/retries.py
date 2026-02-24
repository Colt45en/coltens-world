"""BRAIN ARCHITECTURE: Nucleus Orchestration Lane → Retry Policy

Exponential backoff retry logic with jitter:
- Prevents thundering herd
- Configurable max attempts, base delay, max delay
- Random jitter (±jitter%) for load distribution

Used by Scheduler for job retry policies.
"""

from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 3
    base_delay_s: float = 0.25
    max_delay_s: float = 3.0
    jitter: float = 0.15


def backoff_delay_s(policy: RetryPolicy, attempt: int) -> float:
    exp = policy.base_delay_s * (2 ** (attempt - 1))
    exp = min(exp, policy.max_delay_s)
    j = exp * policy.jitter * (random.random() * 2.0 - 1.0)
    return max(0.0, exp + j)
