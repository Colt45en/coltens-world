"""Wheel Curriculum Runtime v1 (Brain)

Deterministic, resumable learning wheel orchestrator using V1 contract envelopes.
- Owns WheelPlan + WheelState
- Uses make_v1_event / make_v1_command for envelope creation
- Emits nucleus.tool_call events via EventBus
- Consumes nucleus.tool_result commands via on_command()
- Advances stops + rotations deterministically
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypedDict, cast

from ..contracts_v1_schema import content_hash_id, make_v1_command, make_v1_event
from ..contracts_v1_types import V1CommandEnvelope

JsonValue = None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]


class WheelRuntimeError(RuntimeError):
    """Compatibility error type for curriculum runtime callers/tests."""


# ============================================================================
# TYPE DEFINITIONS (matching JSON schema)
# ============================================================================


class StopSpec(TypedDict):
    label: str
    loop1_points: List[str]
    lesson_pool: List[str]


class AgentToolSpec(TypedDict):
    tool_name: str
    expects: str


class MutationPolicy(TypedDict):
    seed: int
    max_pool_items_per_stop_per_rotation: int
    no_repeat_within_last_rotations: int


class WheelPlan(TypedDict):
    version: str
    wheel_id: str
    title: str
    total_rotations: int
    stop_order: List[str]
    stops: Dict[str, StopSpec]
    agent_tool: AgentToolSpec
    mutation_policy: MutationPolicy
    guardian_invariants: List[str]


class ActiveCall(TypedDict):
    call_id: str
    rotation: int
    stop_id: str
    points: List[str]


class PickRecord(TypedDict):
    rotation: int
    item: str


class HistoryRecord(TypedDict, total=False):
    rotation: int
    stop_id: str
    call_id: str
    ok: bool
    summary: str


class WheelState(TypedDict):
    version: str
    wheel_id: str
    trace_id: str
    seq: int
    rotation: int
    stop_index: int
    completed: Dict[str, Dict[str, bool]]  # completed[str(rotation)][stop_id] = true
    recent_pool_picks: Dict[str, List[PickRecord]]
    active_call: Optional[ActiveCall]
    history: List[HistoryRecord]


# ============================================================================
# HELPERS
# ============================================================================


def fnv1a_32(s: str) -> int:
    """Classic FNV-1a hash for deterministic seeding"""
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def mulberry32(seed: int) -> Callable[[], float]:
    """Deterministic RNG (mulberry32 algorithm)"""
    a = seed & 0xFFFFFFFF

    def rnd() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        t ^= t >> 14
        return (t & 0xFFFFFFFF) / 4294967296.0

    return rnd


def _ensure_rotation_bucket(state: WheelState) -> None:
    """Ensure completed[rotation] dict exists"""
    key = str(state["rotation"])
    if key not in state["completed"]:
        state["completed"][key] = {}


def _guardian_assert(cond: bool, msg: str) -> None:
    """Assertion helper"""
    if not cond:
        raise RuntimeError(f"WheelRuntime invariant failed: {msg}")


def _pick_pool_items(plan: WheelPlan, state: WheelState, stop_id: str) -> List[str]:
    """Deterministically pick pool items with anti-repeat logic"""
    pol = plan["mutation_policy"]
    seed_base = pol["seed"]
    max_n = pol["max_pool_items_per_stop_per_rotation"]
    no_rep_k = pol["no_repeat_within_last_rotations"]

    stop = plan["stops"][stop_id]
    rng = mulberry32(
        seed_base ^ fnv1a_32(f"{plan['wheel_id']}:{stop_id}:{state['rotation']}")
    )

    recent = state["recent_pool_picks"].get(stop_id, [])
    blocked = {
        r["item"] for r in recent if (state["rotation"] - r["rotation"]) <= no_rep_k
    }

    candidates = [x for x in stop["lesson_pool"] if x not in blocked]
    source = candidates if candidates else list(stop["lesson_pool"])

    # deterministic shuffle (Fisher-Yates)
    arr = list(source)
    for i in range(len(arr) - 1, 0, -1):
        j = int(rng() * (i + 1))
        arr[i], arr[j] = arr[j], arr[i]

    return arr[: min(max_n, len(arr))]


def _compile_points(plan: WheelPlan, state: WheelState, stop_id: str) -> List[str]:
    """Get teaching points for this rotation"""
    stop = plan["stops"][stop_id]
    if state["rotation"] == 1:
        return list(stop["loop1_points"])
    return _pick_pool_items(plan, state, stop_id)


def _compile_prompt(
    plan: WheelPlan, state: WheelState, stop_id: str, points: List[str]
) -> str:
    """Build agent prompt payload for a stop"""
    stop = plan["stops"][stop_id]
    lines = [
        f"WHEEL: {plan['title']}",
        f"wheel_id={plan['wheel_id']}",
        f"trace_id={state['trace_id']}",
        f"rotation={state['rotation']}/{plan['total_rotations']}",
        f"stop={stop_id} :: {stop['label']}",
        "",
        "TEACHING POINTS (use these exactly as the lesson anchors):",
        *[f"- {p}" for p in points],
        "",
        "REQUIRED OUTPUT (deterministic structure):",
        "1) 3-sentence explanation",
        "2) 3 examples",
        "3) 3 quick checks (Q->A)",
        "4) 1 common mistake + correction",
        "5) tags[] (5-10 tokens)",
    ]
    return "\n".join(lines)


# ============================================================================
# MAIN RUNTIME
# ============================================================================


class WheelRuntime:
    """Deterministic wheel curriculum orchestrator using V1 envelopes"""

    def __init__(self, plan: WheelPlan, state: WheelState, bus: Any):
        self.plan = plan
        self.state = state
        self.bus = bus
        self._validate_plan()
        self._validate_state()

    def _validate_plan(self) -> None:
        """Check plan invariants"""
        _guardian_assert(
            self.plan["version"] == "wheel.plan.v1",
            "plan.version must be wheel.plan.v1",
        )
        _guardian_assert(
            self.plan["total_rotations"] >= 1, "total_rotations must be >= 1"
        )
        _guardian_assert(
            len(self.plan["stop_order"]) > 0, "stop_order must not be empty"
        )
        for sid in self.plan["stop_order"]:
            _guardian_assert(
                sid in self.plan["stops"], f"stop_order references missing stop '{sid}'"
            )

    def _validate_state(self) -> None:
        """Check state invariants"""
        _guardian_assert(
            self.state["version"] == "wheel.state.v1",
            "state.version must be wheel.state.v1",
        )
        _guardian_assert(
            self.state["wheel_id"] == self.plan["wheel_id"],
            "state.wheel_id must match plan.wheel_id",
        )
        _guardian_assert(self.state["rotation"] >= 1, "rotation must be >= 1")
        _guardian_assert(
            0 <= self.state["stop_index"] < len(self.plan["stop_order"]),
            "stop_index out of range",
        )

    def _next_seq(self) -> int:
        """Increment and return next sequence number"""
        self.state["seq"] += 1
        return self.state["seq"]

    async def tick(self, *, ts_ms: int) -> None:
        """
        Emits nucleus.tool_call if:
          - wheel not done
          - not waiting on an active call
          - current stop not already completed for this rotation
        """
        if self.state["rotation"] > self.plan["total_rotations"]:
            await self._emit_event(
                event_type="brain.curriculum.completed",
                ts_ms=ts_ms,
                payload={
                    "wheel_id": self.plan["wheel_id"],
                    "trace_id": self.state["trace_id"],
                },
            )
            return

        if self.state["active_call"] is not None:
            return  # waiting for nucleus.tool_result

        stop_id = self.plan["stop_order"][self.state["stop_index"]]
        _ensure_rotation_bucket(self.state)

        if self.state["completed"][str(self.state["rotation"])].get(stop_id) is True:
            self._advance()
            await self.tick(ts_ms=ts_ms)
            return

        points = _compile_points(self.plan, self.state, stop_id)
        prompt = _compile_prompt(self.plan, self.state, stop_id, points)

        # deterministic + trace-unique call id using content_hash_id
        call_id = content_hash_id(
            "call",
            {
                "trace_id": self.state["trace_id"],
                "wheel_id": self.plan["wheel_id"],
                "rotation": self.state["rotation"],
                "stop_id": stop_id,
                "stop_index": self.state["stop_index"],
            },
        )

        self.state["active_call"] = {
            "call_id": call_id,
            "rotation": self.state["rotation"],
            "stop_id": stop_id,
            "points": points,
        }

        args: Dict[str, JsonValue] = {
            "contract": cast(JsonValue, self.plan["agent_tool"]["expects"]),
            "wheel_id": cast(JsonValue, self.plan["wheel_id"]),
            "trace_id": cast(JsonValue, self.state["trace_id"]),
            "rotation": cast(JsonValue, self.state["rotation"]),
            "stop_id": cast(JsonValue, stop_id),
            "stop_label": cast(JsonValue, self.plan["stops"][stop_id]["label"]),
            "teaching_points": cast(JsonValue, points),
            "prompt": cast(JsonValue, prompt),
            "guardian_invariants": cast(JsonValue, self.plan["guardian_invariants"]),
        }

        payload: Dict[str, JsonValue] = {
            "call_id": call_id,
            "tool": cast(JsonValue, self.plan["agent_tool"]["tool_name"]),
            "args": cast(JsonValue, args),
        }

        await self._emit_event(
            event_type="nucleus.tool_call", ts_ms=ts_ms, payload=payload
        )

    async def on_command(self, cmd: V1CommandEnvelope) -> None:
        """
        Feed nucleus.tool_result here.
        Expected payload:
          { "call_id": str, "ok": bool, "result": { ...json... } }
        """
        if cmd.command_type != "nucleus.tool_result":
            return

        active = self.state["active_call"]
        if active is None:
            return

        payload = cast(Dict[str, Any], cmd.payload)
        call_id = cast(str, payload.get("call_id", ""))
        if call_id != active["call_id"]:
            return  # stale/out-of-order result; ignore

        ok = bool(payload.get("ok", False))
        result = cast(Dict[str, Any], payload.get("result", {}))
        summary = result.get("summary")
        summary_s = summary if isinstance(summary, str) else ""

        # mark stop complete
        _ensure_rotation_bucket(self.state)
        self.state["completed"][str(active["rotation"])][active["stop_id"]] = True

        # record picks actually used (exact points that were sent)
        if active["rotation"] >= 2:
            lst = self.state["recent_pool_picks"].setdefault(active["stop_id"], [])
            for item in active["points"]:
                lst.append({"rotation": active["rotation"], "item": item})
            while len(lst) > 60:
                lst.pop(0)

        self.state["history"].append(
            {
                "rotation": active["rotation"],
                "stop_id": active["stop_id"],
                "call_id": active["call_id"],
                "ok": ok,
                "summary": summary_s,
            }
        )

        self.state["active_call"] = None
        self._advance()

        # progress event (optional but very useful for dashboards)
        await self._emit_event(
            event_type="brain.curriculum.progress",
            ts_ms=cmd.ts_ms,
            payload={
                "wheel_id": self.plan["wheel_id"],
                "trace_id": self.state["trace_id"],
                "rotation": self.state["rotation"],
                "stop_index": self.state["stop_index"],
            },
        )

    def _advance(self) -> None:
        """Move to next stop, wrapping rotation if needed"""
        self.state["stop_index"] += 1
        if self.state["stop_index"] >= len(self.plan["stop_order"]):
            self.state["stop_index"] = 0
            self.state["rotation"] += 1

    async def _emit_event(
        self, *, event_type: str, ts_ms: int, payload: Dict[str, JsonValue]
    ) -> None:
        """Emit a V1EventEnvelope"""
        env = make_v1_event(
            event_type=event_type,
            ts_ms=ts_ms,
            trace_id=self.state["trace_id"],
            seq=self._next_seq(),
            payload=payload,
        )
        await self.bus.emit_event_nucleus_only(env, caller="brain")

    async def emit_command(
        self, *, command_type: str, ts_ms: int, payload: Dict[str, JsonValue]
    ) -> None:
        """Emit a V1CommandEnvelope"""
        env = make_v1_command(
            command_type=command_type,
            ts_ms=ts_ms,
            trace_id=self.state["trace_id"],
            payload=payload,
        )
        await self.bus.send_command(env)

    def save_state_json(self, path: str | Path) -> None:
        """Persist state to JSON"""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2, sort_keys=True)

    @staticmethod
    def load_json(path: str | Path) -> Any:
        """Load JSON file"""
        candidate = Path(path)
        if not candidate.is_absolute() and not candidate.exists():
            repo_root = Path(__file__).resolve().parents[2]
            alt = repo_root / candidate
            if alt.exists():
                candidate = alt
        with open(candidate, "r", encoding="utf-8") as f:
            return json.load(f)
