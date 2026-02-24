from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List

from ..contracts import Modality, PerceptionEmbeddingRecord, new_id, utc_ms


def _normalize(v: List[float]) -> List[float]:
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]


@dataclass
class PerceptionHealth:
    avg_trust: float
    quality: float
    count: int


class PerceptionIngestionLayer:
    """
    Reference CAM:
    - Vision ingest: payload -> pseudo-encoder -> embedding
    - Telemetry ingest: payload -> 128D vector-ish embedding
    """

    def __init__(self, *, max_records: int = 512) -> None:
        self._records: list[PerceptionEmbeddingRecord] = []
        self._max = max_records

    def ingest(self, modality: Modality, payload: Dict[str, Any], agent_id: str, trust: float) -> PerceptionEmbeddingRecord:
        if modality == Modality.VISION:
            emb = self.ingest_vision(payload)
        else:
            emb = self.ingest_telemetry(payload)

        rec = PerceptionEmbeddingRecord(
            embedding_id=new_id("emb"),
            embedding=emb,
            trust_weight=float(max(0.0, min(1.0, trust))),
            source_agent=agent_id,
            modality=modality,
            ts_ms=utc_ms(),
        )
        self._records.append(rec)
        if len(self._records) > self._max:
            self._records = self._records[-self._max :]
        return rec

    def ingest_vision(self, payload: Dict[str, Any]) -> List[float]:
        sig = payload.get("frame_signature")
        if isinstance(sig, list) and sig:
            raw = [float((x % 257) - 128) for x in sig[:128]]
        else:
            items = sorted((str(k), str(v)) for k, v in payload.items())
            raw = [float((sum(map(ord, (a + b))) % 257) - 128) for a, b in items][:128]
            if not raw:
                raw = [0.0] * 128
        raw = (raw + [0.0] * 128)[:128]
        return _normalize(raw)

    def ingest_telemetry(self, payload: Dict[str, Any]) -> List[float]:
        items = sorted(payload.items(), key=lambda kv: str(kv[0]))
        raw: list[float] = []
        for k, v in items:
            s = f"{k}:{v}"
            raw.append(float((sum(map(ord, s)) % 257) - 128))
            if len(raw) >= 128:
                break
        raw = (raw + [0.0] * 128)[:128]
        return _normalize(raw)

    def get_health(self) -> PerceptionHealth:
        if not self._records:
            return PerceptionHealth(avg_trust=0.0, quality=0.0, count=0)
        avg_trust = sum(r.trust_weight for r in self._records) / len(self._records)
        quality = avg_trust * min(1.0, len(self._records) / 64.0)
        return PerceptionHealth(avg_trust=avg_trust, quality=quality, count=len(self._records))

    def last_records(self, n: int = 8) -> list[PerceptionEmbeddingRecord]:
        return self._records[-n:]
