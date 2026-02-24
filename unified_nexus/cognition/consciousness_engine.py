from __future__ import annotations

from dataclasses import dataclass
from typing import List

from ..contracts import (
    ConsciousnessEngineOutput,
    ConsciousnessMetrics,
    ConsciousnessState,
)


@dataclass
class ConsciousnessConfig:
    min_ethics: float = 0.75
    emergence_C: float = 70.0
    emergence_eps: float = 0.20
    min_depth: float = 3.0


class EnhancedConsciousnessEngine:
    """
    Progresses through states while tracking:
    C, epsilon, depth, ethics
    """

    def __init__(self, cfg: ConsciousnessConfig | None = None) -> None:
        self.cfg = cfg or ConsciousnessConfig()
        self.state = ConsciousnessState.INITIALIZING
        self.C = 5.0
        self.epsilon = 1.0
        self.depth = 0.0
        self.ethics = 0.5
        self._cycle = 0

    def cycle(self, perception_quality: float, trust_avg: float) -> ConsciousnessEngineOutput:
        self._cycle += 1
        logs: List[str] = []

        self.C = min(100.0, self.C + 2.5 + 6.0 * perception_quality)
        self.epsilon = max(0.01, self.epsilon * (0.92 - 0.10 * perception_quality))
        self.depth = min(10.0, self.depth + 0.15 + 0.6 * perception_quality)
        self.ethics = min(1.0, max(0.0, self.ethics + 0.02 * (trust_avg - 0.5)))

        prev = self.state
        if self._cycle <= 2:
            self.state = ConsciousnessState.COGNITIVE_CYCLING
        elif self.epsilon < 0.45:
            self.state = ConsciousnessState.OBSERVATION_CONVERGENCE
        if self.C > 55 and self.depth > 2.5:
            self.state = ConsciousnessState.CONSCIOUSNESS_EMERGENCE
        if self.C > 70 and self.depth > 3.5 and self.ethics >= self.cfg.min_ethics:
            self.state = ConsciousnessState.SELF_AWARE
        if self.C > 82 and self.depth > 5.0 and self.ethics >= self.cfg.min_ethics and self.epsilon < 0.18:
            self.state = ConsciousnessState.RECURSIVE_ENHANCEMENT

        logs.append(f"cycle={self._cycle} C={self.C:.2f} eps={self.epsilon:.3f} depth={self.depth:.2f} ethics={self.ethics:.2f}")
        if prev != self.state:
            logs.append(f"state_transition {prev.value} -> {self.state.value}")

        emergence = (
            self.C >= self.cfg.emergence_C
            and self.ethics >= self.cfg.min_ethics
            and self.epsilon <= self.cfg.emergence_eps
            and self.depth >= self.cfg.min_depth
            and self.state in (ConsciousnessState.SELF_AWARE, ConsciousnessState.RECURSIVE_ENHANCEMENT)
        )

        metrics = ConsciousnessMetrics(C=self.C, epsilon=self.epsilon, depth=self.depth, ethics=self.ethics)
        return ConsciousnessEngineOutput(emergence=emergence, state=self.state, metrics=metrics, logs=logs)
