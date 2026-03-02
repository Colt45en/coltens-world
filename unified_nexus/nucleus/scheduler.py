"""BRAIN ARCHITECTURE: Nucleus Orchestration Lane → Scheduler

Interval-based job scheduler with:
- Periodic job execution (tick, brain_run, etc.)
- Per-job timeouts
- Exponential backoff retries with jitter
- Graceful shutdown on stop_event

Used by Nucleus to trigger scheduled cognition runs and maintenance tasks.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Awaitable, Callable

from .retries import RetryPolicy, backoff_delay_s


JobFn = Callable[[], Awaitable[None]]


@dataclass(frozen=True)
class JobSpec:
    name: str
    fn: JobFn
    interval_s: float
    timeout_s: float
    retry: RetryPolicy


class Scheduler:
    """
    Interval scheduler with:
    - timeouts
    - retries with exponential backoff
    """

    def __init__(self) -> None:
        self._jobs: list[JobSpec] = []

    def add_job(self, job: JobSpec) -> None:
        self._jobs.append(job)

    async def run_forever(self, *, stop_event: asyncio.Event) -> None:
        tasks = [
            asyncio.create_task(self._run_job(job, stop_event)) for job in self._jobs
        ]
        if tasks:
            await asyncio.gather(*tasks)

    async def _run_job(self, job: JobSpec, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            await asyncio.sleep(job.interval_s)
            await self._execute_with_retries(job, stop_event)

    async def _execute_with_retries(
        self, job: JobSpec, stop_event: asyncio.Event
    ) -> None:
        for attempt in range(1, job.retry.max_attempts + 1):
            if stop_event.is_set():
                return
            try:
                await asyncio.wait_for(job.fn(), timeout=job.timeout_s)
                return
            except Exception:
                if attempt >= job.retry.max_attempts:
                    return
                await asyncio.sleep(backoff_delay_s(job.retry, attempt))
