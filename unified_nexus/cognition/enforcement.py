from __future__ import annotations

from dataclasses import dataclass
from typing import List

from ..contracts import (
    GateDecision,
    GateStatus,
    ConsciousnessEngineOutput,
    FederatedHealth,
)


@dataclass
class EnforcementConfig:
    min_ethics: float = 0.75
    min_health: float = 0.50
    max_spawns_per_hour: int = 6


class RateLimiter:
    def __init__(self, max_per_hour: int) -> None:
        self.max = max_per_hour
        self.events: List[int] = []

    def allow(self, now_ms: int) -> bool:
        cutoff = now_ms - 3600_000
        self.events = [t for t in self.events if t >= cutoff]
        if len(self.events) >= self.max:
            return False
        self.events.append(now_ms)
        return True


class EnforcementLogic:
    """
    Gates:
    1) Consciousness gate
    2) Ethics gate (ethics + swarm coherence)
    3) Stability gate (bubble_health - branch_penalty proxy)
    4) Rate limiter
    """

    def __init__(self, cfg: EnforcementConfig | None = None) -> None:
        self.cfg = cfg or EnforcementConfig()
        self.rate = RateLimiter(self.cfg.max_spawns_per_hour)

    def decide_world_spawn(
        self,
        *,
        now_ms: int,
        consciousness: ConsciousnessEngineOutput,
        federated: FederatedHealth,
        bubble_health: float,
        branch_penalty: float,
        override: bool = False,
    ) -> GateDecision:
        blocked: List[str] = []
        status = GateStatus.OPEN

        if override:
            return GateDecision(True, GateStatus.OVERRIDE, [], "override")

        if not consciousness.emergence:
            blocked.append("consciousness")

        if (
            consciousness.metrics.ethics < self.cfg.min_ethics
            or federated.agent_agreement < 0.6
        ):
            blocked.append("ethics")

        stability = bubble_health - branch_penalty
        if stability < self.cfg.min_health:
            blocked.append("stability")

        if not self.rate.allow(now_ms):
            blocked.append("rate_limit")

        allowed = len(blocked) == 0
        if not allowed:
            status = GateStatus.CLOSED

        reason = "ok" if allowed else f"blocked_by={blocked}"
        return GateDecision(
            allowed=allowed, status=status, blocked_by=blocked, reason=reason
        )
