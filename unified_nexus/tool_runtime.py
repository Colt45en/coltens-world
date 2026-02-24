"""BRAIN ARCHITECTURE: Tool Runtime

Tool execution lane that:
- Subscribes to nucleus.tool_call events (request)
- Queues tool calls and executes serially (deterministic order)
- Sends results back via nucleus.tool_result commands (response)

Flow:
1. Nucleus emits nucleus.tool_call event with call_id
2. ToolRuntime receives event → queues ToolCall
3. Serial executor pulls from queue → runs tool function
4. Result (ok + data OR error) sent as nucleus.tool_result command
5. Nucleus logs result event + resolves awaiting Future

Determinism: Tools execute in strict queue order, preventing concurrent side-effect interleaving.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict

from .contracts_v1_schema import make_v1_command
from .contracts_v1_types import V1EventEnvelope
from .event_bus import EventBus

TOOL_CALL_EVENT = "nucleus.tool_call"
TOOL_RESULT_COMMAND = "nucleus.tool_result"

ToolFn = Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]


@dataclass(frozen=True, order=True)
class ToolCall:
    seq: int  # For deterministic ordering
    call_id: str
    tool: str
    args: Dict[str, Any]
    trace_id: str


class ToolRuntime:
    """
    Tool execution runtime that:
    - Subscribes to nucleus.tool_call events
    - Executes tools serially (deterministic order)
    - Returns results via nucleus.tool_result commands
    """

    def __init__(self, bus: EventBus, tools: Dict[str, ToolFn], *, max_queue: int = 1000) -> None:
        self.bus = bus
        self.tools = tools
        self._q: "asyncio.PriorityQueue[ToolCall]" = asyncio.PriorityQueue(maxsize=max_queue)
        self._max_queue = max_queue

        self.bus.subscribe_event(TOOL_CALL_EVENT, self._on_tool_call_event)

    async def _on_tool_call_event(self, evt: V1EventEnvelope) -> None:
        p = dict(evt.payload or {})

        # Fallback chain for call_id: payload.call_id OR command_id OR evt_seq
        call_id = str(p.get("call_id") or p.get("command_id") or f"evt_{evt.seq}").strip()

        tool = str(p.get("tool") or "").strip()
        args = dict(p.get("args") or {})

        if not tool:
            # Emit error result for missing tool name
            await self._emit_error_result(call_id, evt.trace_id, "Missing tool name")
            return

        # Check queue overflow
        if self._q.qsize() >= self._max_queue:
            await self._emit_error_result(
                call_id,
                evt.trace_id,
                f"Tool queue overflow: {self._q.qsize()}/{self._max_queue}"
            )
            return

        # Enqueue with seq for deterministic ordering
        try:
            await self._q.put(ToolCall(
                seq=evt.seq,
                call_id=call_id,
                tool=tool,
                args=args,
                trace_id=evt.trace_id
            ))
        except asyncio.QueueFull:
            await self._emit_error_result(call_id, evt.trace_id, "Queue full")

    async def _emit_error_result(self, call_id: str, trace_id: str, error_msg: str) -> None:
        """Emit error result command for dropped/invalid tool calls."""
        cmd = make_v1_command(
            command_type=TOOL_RESULT_COMMAND,
            ts_ms=self._now_ms(),
            trace_id=trace_id,
            payload={"call_id": call_id, "ok": False, "error": error_msg},
        )
        await self.bus.send_command(cmd)

    async def run_forever(self, *, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                call = await asyncio.wait_for(self._q.get(), timeout=0.25)
            except asyncio.TimeoutError:
                continue

            try:
                fn = self.tools.get(call.tool)
                if fn is None:
                    raise KeyError(f"Unknown tool: {call.tool}")

                result = await fn(call.args)

                cmd = make_v1_command(
                    command_type=TOOL_RESULT_COMMAND,
                    ts_ms=self._now_ms(),
                    trace_id=call.trace_id,
                    payload={"call_id": call.call_id, "ok": True, "result": result},
                )
                await self.bus.send_command(cmd)

            except Exception as exc:
                cmd = make_v1_command(
                    command_type=TOOL_RESULT_COMMAND,
                    ts_ms=self._now_ms(),
                    trace_id=call.trace_id,
                    payload={"call_id": call.call_id, "ok": False, "error": f"{type(exc).__name__}: {exc}"},
                )
                await self.bus.send_command(cmd)

            finally:
                self._q.task_done()

    @staticmethod
    def _now_ms() -> int:
        import time
        return int(time.time() * 1000)
