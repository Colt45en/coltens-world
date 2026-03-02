"""BRAIN ARCHITECTURE: Nucleus Orchestration Lane

Core orchestration layer that:
- Schedules periodic cognition runs (tick, brain_run)
- Manages deterministic event sequencing (via _emit_lock)
- Provides tool call correlation (call_id → Future → result)
- Enforces backpressure watermarks (soft/hard reject)
- Maintains audit trail (DeterministicEventLog + SQLiteImprintStore)

Key flows:
- cognition.request_emit → emit event
- call_tool() → nucleus.tool_call event → await nucleus.tool_result command
- All events get deterministic seq numbers under lock
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict, Optional

from ..contracts_v1_schema import make_v1_event
from ..contracts_v1_types import V1CommandEnvelope, V1EventEnvelope
from ..event_bus import EventBus
from ..logging import DeterministicEventLog
from ..storage import SQLiteImprintStore
from .scheduler import JobSpec, Scheduler
from .retries import RetryPolicy


TOOL_CALL_EVENT = "nucleus.tool_call"  # event type
TOOL_RESULT_COMMAND = "nucleus.tool_result"  # command type
COGNITION_EMIT_COMMAND = "cognition.request_emit"


@dataclass
class NucleusConfig:
    tick_interval_s: float = 0.5
    tick_timeout_s: float = 1.0
    brain_run_interval_s: float = 2.0
    brain_run_timeout_s: float = 5.0

    # Backpressure thresholds for command queue utilization
    cmd_soft_watermark: float = 0.60
    cmd_hard_watermark: float = 0.85

    # Tool call settings
    tool_timeout_s: float = 8.0
    reject_tool_calls_when_overloaded: bool = True


class Nucleus:
    """
    Orchestration lane:
    - owns scheduling, queues, event dispatch, retries, timeouts
    - triggers Brain runs automatically
    - provides Tool Runtime access by publishing tool_call events
    """

    def __init__(self, bus: EventBus, cfg: Optional[NucleusConfig] = None) -> None:
        self.bus = bus
        self.cfg = cfg or NucleusConfig()

        self.stop_event = asyncio.Event()
        self.scheduler = Scheduler()

        # Determinism core: _seq + event log + store must be serialized.
        self._seq = 0
        self._emit_lock = asyncio.Lock()

        self._event_log = DeterministicEventLog()
        self._store = SQLiteImprintStore()

        # Tool correlation
        self._tool_seq = 0
        self._tool_lock = asyncio.Lock()
        self._pending_tool_results: Dict[str, asyncio.Future[Dict[str, Any]]] = {}

        self._jobs_installed = False

        self.bus.register_command_handler(COGNITION_EMIT_COMMAND, self._cmd_emit_event)
        self.bus.register_command_handler(TOOL_RESULT_COMMAND, self._cmd_tool_result)

    def install_jobs(self) -> None:
        if self._jobs_installed:
            return
        self._jobs_installed = True

        self.scheduler.add_job(
            JobSpec(
                name="tick",
                fn=self._tick,
                interval_s=self.cfg.tick_interval_s,
                timeout_s=self.cfg.tick_timeout_s,
                retry=RetryPolicy(max_attempts=2),
            )
        )
        self.scheduler.add_job(
            JobSpec(
                name="brain_run",
                fn=self._brain_run,
                interval_s=self.cfg.brain_run_interval_s,
                timeout_s=self.cfg.brain_run_timeout_s,
                retry=RetryPolicy(max_attempts=2),
            )
        )

    async def start(self) -> None:
        self.install_jobs()

        # If either loop dies with an exception, shut down the system.
        bus_task = asyncio.create_task(
            self.bus.run_forever(stop_event=self.stop_event), name="nucleus.bus"
        )
        sched_task = asyncio.create_task(
            self.scheduler.run_forever(stop_event=self.stop_event),
            name="nucleus.scheduler",
        )

        try:
            done, pending = await asyncio.wait(
                {bus_task, sched_task},
                return_when=asyncio.FIRST_EXCEPTION,
            )

            # Propagate exceptions (and stop everything).
            for t in done:
                exc = t.exception()
                if exc is not None:
                    self.shutdown()
                    raise exc

            # If one task ended cleanly, stop the other.
            self.shutdown()
            await asyncio.gather(*pending, return_exceptions=True)
        finally:
            await self.aclose()

    def shutdown(self) -> None:
        self.stop_event.set()

    async def aclose(self) -> None:
        # Clean shutdown hook if store exposes close()/aclose()
        close = getattr(self._store, "close", None)
        if callable(close):
            close()
        aclose = getattr(self._store, "aclose", None)
        if callable(aclose):
            await aclose()

    async def _tick(self) -> None:
        await self._emit("nucleus.tick", {"kind": "tick"}, trace_id="trace_tick")

    async def _brain_run(self) -> None:
        await self._emit(
            "nucleus.brain_run", {"kind": "brain_run"}, trace_id="trace_brain"
        )

    async def call_tool(
        self, tool_name: str, args: Dict[str, Any], trace_id: str = "trace_tool"
    ) -> Dict[str, Any]:
        tool = str(tool_name or "").strip()
        if not tool:
            raise ValueError("tool_name must be non-empty")

        if self.cfg.reject_tool_calls_when_overloaded and self._should_reject("normal"):
            raise RuntimeError(
                f"overloaded: level={self._overload_level():.3f}, priority=normal"
            )

        # Deterministic, in-process call id
        loop = asyncio.get_running_loop()
        async with self._tool_lock:
            self._tool_seq += 1
            call_id = f"tool_{self._tool_seq}"
            fut: asyncio.Future[Dict[str, Any]] = loop.create_future()
            if call_id in self._pending_tool_results:
                raise RuntimeError(f"duplicate call_id generated: {call_id}")
            self._pending_tool_results[call_id] = fut

        # Emit tool request event (nucleus-only permitted)
        await self._emit(
            TOOL_CALL_EVENT,
            {
                "call_id": call_id,
                "tool": tool,
                "args": dict(args or {}),
            },
            trace_id=trace_id,
        )

        try:
            return await asyncio.wait_for(fut, timeout=self.cfg.tool_timeout_s)
        finally:
            self._pending_tool_results.pop(call_id, None)

    async def _emit(
        self, event_type: str, payload: Dict[str, Any], trace_id: str
    ) -> V1EventEnvelope:
        if not event_type:
            raise ValueError("event_type must be non-empty")

        # Serialize seq allocation + event log append + store mirror.
        async with self._emit_lock:
            self._seq += 1
            evt = make_v1_event(
                event_type=event_type,
                ts_ms=self._now_ms(),
                trace_id=trace_id,
                seq=self._seq,
                payload=payload,
            )
            self._event_log.append(evt)
            self._store.mirror_event(
                seq=evt.seq,
                event_id=evt.event_id,
                event_type=evt.event_type,
                ts_ms=evt.ts_ms,
                trace_id=evt.trace_id,
                payload=evt.payload,
            )

        await self.bus.emit_event_nucleus_only(evt, caller="nucleus")
        return evt

    async def _cmd_emit_event(self, cmd: V1CommandEnvelope) -> Dict[str, Any]:
        priority = str(cmd.payload.get("priority", "normal"))
        if self._should_reject(priority):
            raise RuntimeError(
                f"overloaded: level={self._overload_level():.3f}, priority={priority}"
            )

        event_type_raw = cmd.payload.get("event_type")
        if not event_type_raw:
            raise ValueError("missing required payload key: event_type")

        event_type = str(event_type_raw)
        payload = dict(cmd.payload.get("event_payload", {}) or {})
        trace_id = cmd.trace_id

        evt = await self._emit(event_type, payload, trace_id)
        return {
            "emitted_event_id": evt.event_id,
            "seq": evt.seq,
            "chain_head": self._event_log.head_hash,
        }

    def _overload_level(self) -> float:
        m = self.bus.metrics()
        if m.cmd_q_max <= 0:
            return 0.0
        return m.cmd_q_size / float(m.cmd_q_max)

    def _should_reject(self, priority: str) -> bool:
        level = self._overload_level()
        if priority == "low":
            return level >= self.cfg.cmd_soft_watermark
        if priority == "normal":
            return level >= self.cfg.cmd_hard_watermark
        return False

    async def _cmd_tool_result(self, cmd: V1CommandEnvelope) -> Dict[str, Any]:
        payload = dict(cmd.payload or {})
        call_id = str(payload.get("call_id") or "").strip()
        if not call_id:
            raise ValueError("tool_result missing call_id")

        ok = bool(payload.get("ok", False))
        result = payload.get("result")
        error = payload.get("error")

        # Log the tool result as an event (deterministic audit trail)
        await self._emit(
            "nucleus.tool_result",
            {
                "call_id": call_id,
                "ok": ok,
                "result": result if ok else None,
                "error": error if not ok else None,
            },
            trace_id=cmd.trace_id,
        )

        fut = self._pending_tool_results.get(call_id)
        if fut is not None and not fut.done():
            if ok:
                fut.set_result({"ok": True, "call_id": call_id, "result": result})
            else:
                fut.set_result(
                    {
                        "ok": False,
                        "call_id": call_id,
                        "error": str(error or "ToolError"),
                    }
                )

        # Always ACK receipt (even if caller timed out and fut is gone)
        return {"accepted": True, "call_id": call_id}

    @staticmethod
    def _now_ms() -> int:
        import time

        return int(time.time() * 1000)
