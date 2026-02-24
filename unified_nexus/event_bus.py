"""BRAIN ARCHITECTURE: Nucleus Orchestration Lane → EventBus

Split-channel message bus with:
- Event channel (broadcast, nucleus-only emission)
- Command channel (single-consumer, ACK/NACK)
- Command correlation via pending_acks futures
- Backpressure metrics (queue sizes + watermarks)

Flow:
- nucleus → emit_event_nucleus_only() → event_q → dispatch to subscribers
- any → send_command() → cmd_q → single handler → ACK/NACK
- send_command_await_acks() correlates by command_id
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Callable, Coroutine, Dict, List, Optional

from .contracts_v1_types import V1EventEnvelope, V1CommandEnvelope


EventHandler = Callable[[V1EventEnvelope], Coroutine[Any, Any, None]]
CommandHandler = Callable[[V1CommandEnvelope], Coroutine[Any, Any, Dict[str, object]]]


@dataclass
class EventSubscription:
    event_type: str
    handler: EventHandler


@dataclass(frozen=True)
class BusMetrics:
    event_q_size: int
    cmd_q_size: int
    event_q_max: int
    cmd_q_max: int


class EventBus:
    """Split-channel bus with nucleus-owned event emission and command ACK/NACK."""

    def __init__(self, *, max_event_q: int = 10_000, max_cmd_q: int = 2_000) -> None:
        self._event_subs: Dict[str, List[EventHandler]] = {}
        self._event_q: "asyncio.Queue[V1EventEnvelope]" = asyncio.Queue(maxsize=max_event_q)
        self._command_handlers: Dict[str, CommandHandler] = {}
        self._command_q: "asyncio.Queue[V1CommandEnvelope]" = asyncio.Queue(maxsize=max_cmd_q)
        self._pending_acks: Dict[str, asyncio.Future[Dict[str, object]]] = {}
        self._max_event_q = max_event_q
        self._max_cmd_q = max_cmd_q

    def subscribe_event(self, event_type: str, handler: EventHandler) -> None:
        self._event_subs.setdefault(event_type, []).append(handler)

    def register_command_handler(self, command_type: str, handler: CommandHandler) -> None:
        self._command_handlers[command_type] = handler

    async def emit_event_nucleus_only(self, evt: V1EventEnvelope, *, caller: str) -> None:
        if caller != "nucleus":
            raise PermissionError("Only nucleus may emit events")
        await self._event_q.put(evt)

    async def send_command(self, cmd: V1CommandEnvelope) -> None:
        await self._command_q.put(cmd)

    def metrics(self) -> BusMetrics:
        return BusMetrics(
            event_q_size=self._event_q.qsize(),
            cmd_q_size=self._command_q.qsize(),
            event_q_max=self._max_event_q,
            cmd_q_max=self._max_cmd_q,
        )

    async def send_command_await_acks(self, cmd: V1CommandEnvelope, timeout_s: float = 2.0) -> Dict[str, object]:
        loop = asyncio.get_running_loop()

        # Guard against duplicate command_id collisions
        if cmd.command_id in self._pending_acks:
            raise RuntimeError(f"duplicate command_id already pending: {cmd.command_id}")

        fut = loop.create_future()
        self._pending_acks[cmd.command_id] = fut
        await self.send_command(cmd)
        try:
            return await asyncio.wait_for(fut, timeout=timeout_s)
        finally:
            self._pending_acks.pop(cmd.command_id, None)

    async def run_forever(self, *, stop_event: asyncio.Event) -> None:
        tasks = [
            asyncio.create_task(self._run_event_dispatch(stop_event)),
            asyncio.create_task(self._run_command_dispatch(stop_event)),
        ]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
        for task in pending:
            task.cancel()
        for task in done:
            exc = task.exception()
            if exc:
                raise exc

    async def _run_event_dispatch(self, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                evt = await asyncio.wait_for(self._event_q.get(), timeout=0.25)
            except asyncio.TimeoutError:
                continue

            handlers = self._event_subs.get(evt.event_type, [])
            tasks = [asyncio.create_task(h(evt)) for h in handlers]
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            self._event_q.task_done()

    async def _run_command_dispatch(self, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                cmd = await asyncio.wait_for(self._command_q.get(), timeout=0.25)
            except asyncio.TimeoutError:
                continue

            handler = self._command_handlers.get(cmd.command_type)
            if handler is None:
                response: Dict[str, object] = {
                    "ok": False,
                    "kind": "NACK",
                    "error": f"Unknown command_type: {cmd.command_type}",
                    "command_id": cmd.command_id,
                    "trace_id": cmd.trace_id,
                }
            else:
                try:
                    payload = await handler(cmd)
                    response = {
                        "ok": True,
                        "kind": "ACK",
                        "command_id": cmd.command_id,
                        "trace_id": cmd.trace_id,
                        "payload": payload,
                    }
                except Exception as exc:
                    response = {
                        "ok": False,
                        "kind": "NACK",
                        "command_id": cmd.command_id,
                        "trace_id": cmd.trace_id,
                        "error": f"{type(exc).__name__}: {exc}",
                    }

            fut: Optional[asyncio.Future[Dict[str, object]]] = self._pending_acks.get(cmd.command_id)
            if fut is not None and not fut.done():
                fut.set_result(response)
            self._command_q.task_done()
