from __future__ import annotations

from dataclasses import dataclass
from typing import List

from ..contracts import FederatedHealth, LocalGradient


@dataclass
class NFALConfig:
    dim: int = 32
    converge_eps: float = 0.02


class NFAL:
    """
    Trust-weighted federated averaging across agents.
    """

    def __init__(self, cfg: NFALConfig | None = None) -> None:
        self.cfg = cfg or NFALConfig()
        self.iteration = 0
        self.global_params = [0.0] * self.cfg.dim
        self._last_loss = 1.0

    def round(self, grads: List[LocalGradient]) -> FederatedHealth:
        self.iteration += 1
        if not grads:
            return FederatedHealth(
                iteration=self.iteration,
                agent_agreement=0.0,
                convergence_rate=0.0,
                federated_loss=self._last_loss,
                converged=False,
            )

        wsum = sum(max(0.0, min(1.0, g.trust)) for g in grads) or 1.0
        agg = [0.0] * self.cfg.dim
        losses = []

        for g in grads:
            w = max(0.0, min(1.0, g.trust)) / wsum
            losses.append(g.loss * w)
            vec = (g.gradient + [0.0] * self.cfg.dim)[: self.cfg.dim]
            for i in range(self.cfg.dim):
                agg[i] += w * vec[i]

        lr = 0.05
        for i in range(self.cfg.dim):
            self.global_params[i] -= lr * agg[i]

        federated_loss = sum(losses)
        convergence_rate = max(0.0, min(1.0, (self._last_loss - federated_loss) + 0.5))
        self._last_loss = federated_loss

        mags = []
        for g in grads:
            vec = (g.gradient + [0.0] * self.cfg.dim)[: self.cfg.dim]
            mags.append(sum(x * x for x in vec) / self.cfg.dim)
        mean_mag = sum(mags) / len(mags)
        var = sum((m - mean_mag) ** 2 for m in mags) / max(1, len(mags) - 1)
        agent_agreement = 1.0 / (1.0 + var)

        converged = federated_loss <= self.cfg.converge_eps
        return FederatedHealth(
            iteration=self.iteration,
            agent_agreement=float(agent_agreement),
            convergence_rate=float(convergence_rate),
            federated_loss=float(federated_loss),
            converged=bool(converged),
        )
