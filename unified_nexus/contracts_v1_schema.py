from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, is_dataclass
from typing import Any, Dict, TypeAlias, cast

from .contracts_v1_types import V1CommandEnvelope, V1EventEnvelope, V1Imprint


JsonValue: TypeAlias = (
    None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
)


def canonical_json_bytes(obj: Any) -> bytes:
    return json.dumps(
        obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def content_hash_id(prefix: str, obj: Any) -> str:
    if is_dataclass(obj):
        obj = asdict(cast(Any, obj))
    h = sha256_hex(canonical_json_bytes(obj))
    return f"{prefix}_{h}"


def validate_jsonable(x: Any, path: str = "$") -> None:
    if x is None or isinstance(x, (bool, int, float, str)):
        return
    if isinstance(x, list):
        xs = cast(list[Any], x)
        for i, v in enumerate(xs):
            validate_jsonable(v, f"{path}[{i}]")
        return
    if isinstance(x, dict):
        obj = cast(dict[Any, Any], x)
        for k, v in obj.items():
            if not isinstance(k, str):
                raise TypeError(f"Non-string key at {path}: {type(k).__name__}")
            validate_jsonable(v, f"{path}.{k}")
        return
    raise TypeError(f"Non-JSON-serializable type at {path}: {type(x).__name__}")


def make_v1_event(
    *,
    event_type: str,
    ts_ms: int,
    trace_id: str,
    seq: int,
    payload: Dict[str, JsonValue],
) -> V1EventEnvelope:
    validate_jsonable(payload)
    tmp: Dict[str, Any] = {
        "v": 1,
        "event_type": event_type,
        "ts_ms": ts_ms,
        "trace_id": trace_id,
        "seq": seq,
        "payload": payload,
    }
    event_id = content_hash_id("evt", tmp)
    return V1EventEnvelope(
        v=1,
        event_type=event_type,
        ts_ms=ts_ms,
        trace_id=trace_id,
        seq=seq,
        payload=payload,
        event_id=event_id,
    )


def make_v1_command(
    *, command_type: str, ts_ms: int, trace_id: str, payload: Dict[str, JsonValue]
) -> V1CommandEnvelope:
    validate_jsonable(payload)
    tmp: Dict[str, Any] = {
        "v": 1,
        "command_type": command_type,
        "ts_ms": ts_ms,
        "trace_id": trace_id,
        "payload": payload,
    }
    command_id = content_hash_id("cmd", tmp)
    return V1CommandEnvelope(
        v=1,
        command_type=command_type,
        ts_ms=ts_ms,
        trace_id=trace_id,
        payload=payload,
        command_id=command_id,
    )


def make_v1_imprint(
    *, ts_ms: int, trace_id: str, kind: str, data: Dict[str, JsonValue]
) -> V1Imprint:
    validate_jsonable(data)
    tmp: Dict[str, Any] = {
        "v": 1,
        "ts_ms": ts_ms,
        "trace_id": trace_id,
        "kind": kind,
        "data": data,
    }
    imprint_id = content_hash_id("imp", tmp)
    return V1Imprint(
        v=1, imprint_id=imprint_id, ts_ms=ts_ms, trace_id=trace_id, kind=kind, data=data
    )


def hash_chain_next(prev_hash_hex: str, event: V1EventEnvelope) -> str:
    b = prev_hash_hex.encode("utf-8") + canonical_json_bytes(
        {
            "v": event.v,
            "event_id": event.event_id,
            "event_type": event.event_type,
            "ts_ms": event.ts_ms,
            "trace_id": event.trace_id,
            "seq": event.seq,
            "payload": event.payload,
        }
    )
    return sha256_hex(b)
