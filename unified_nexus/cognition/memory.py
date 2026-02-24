from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import json

from ..contracts import new_id, utc_ms


@dataclass(frozen=True)
class Imprint:
    imprint_id: str
    ts_ms: int
    kind: str
    trace_id: str
    data: Dict[str, Any]


class ImprintArchive:
    """
    Durable knowledge store (reference: in-memory + exportable).
    """

    def __init__(self, *, max_imprints: int = 2048) -> None:
        self._max = max_imprints
        self._imprints: List[Imprint] = []

    def write(self, kind: str, trace_id: str, data: Dict[str, Any]) -> Imprint:
        imp = Imprint(imprint_id=new_id("imp"), ts_ms=utc_ms(), kind=kind, trace_id=trace_id, data=data)
        self._imprints.append(imp)
        if len(self._imprints) > self._max:
            self._imprints = self._imprints[-self._max :]
        return imp

    def query(self, *, kind: Optional[str] = None, limit: int = 20) -> List[Imprint]:
        xs = self._imprints
        if kind is not None:
            xs = [i for i in xs if i.kind == kind]
        return xs[-limit:]

    def export_ndjson(self) -> str:
        lines = []
        for i in self._imprints:
            lines.append(json.dumps({
                "imprint_id": i.imprint_id,
                "ts_ms": i.ts_ms,
                "kind": i.kind,
                "trace_id": i.trace_id,
                "data": i.data,
            }, sort_keys=True))
        return "\n".join(lines) + ("\n" if lines else "")
