from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import random

from ..contracts import LocalGradient, Modality, ToolSpec
from ..contracts_v1_schema import make_v1_command, make_v1_imprint
from ..contracts_v1_types import V1EventEnvelope
from ..event_bus import EventBus
from ..storage import SQLiteImprintStore

from .perception_cam import PerceptionIngestionLayer
from .consciousness_engine import EnhancedConsciousnessEngine
from .enforcement import EnforcementLogic
from .streaming import ChunkRegistry, StreamingAwareWorldGenerator
from .world_genesis import WorldGenesisOrchestrator
from .nfal import NFAL
from .memory import ImprintArchive
from .operator_runtime import ToolRuntime


def backoff_delay_s(
    attempt: int, *, base: float = 0.05, cap: float = 0.75, jitter: float = 0.20
) -> float:
    delay = min(cap, base * (2 ** (attempt - 1)))
    jitter_amount = delay * jitter * (random.random() * 2.0 - 1.0)
    return max(0.0, delay + jitter_amount)


@dataclass
class CognitionConfig:
    agent_id: str = "cognition.main"
    world_name: str = "Nexus-Prime"
    spawn_regions: int = 3
    spawn_characters: int = 5


class CognitionLane:
    def __init__(self, bus: EventBus, cfg: Optional[CognitionConfig] = None) -> None:
        self.bus = bus
        self.cfg = cfg or CognitionConfig()

        self.perception = PerceptionIngestionLayer()
        self.consciousness = EnhancedConsciousnessEngine()
        self.enforcement = EnforcementLogic()
        self.chunks = ChunkRegistry()
        self.chunks.seed_demo()
        self.streaming = StreamingAwareWorldGenerator(self.chunks)
        self.genesis = WorldGenesisOrchestrator()
        self.nfal = NFAL()
        self.memory = ImprintArchive()
        self._store = SQLiteImprintStore()

        self.tools = ToolRuntime()
        self._install_tools()

        self.bus.subscribe_event("nucleus.tick", self.on_tick)
        self.bus.subscribe_event("nucleus.brain_run", self.on_brain_run)
        self.bus.subscribe_event("nucleus.tool_call", self.on_tool_call)

        self._last_consciousness = None
        self._last_fed = None

    def _install_tools(self) -> None:
        self.tools.register(
            ToolSpec(name="echo", description="Echo args back", timeout_s=1.0),
            lambda args: {"ok": True, "echo": args},
        )
        self.tools.register(
            ToolSpec(name="add", description="Add two numbers: a+b", timeout_s=1.0),
            lambda args: {
                "ok": True,
                "result": float(args.get("a", 0.0)) + float(args.get("b", 0.0)),
            },
        )
        self.tools.register(
            ToolSpec(
                name="imprint_query",
                description="Query imprints by kind",
                timeout_s=2.0,
            ),
            lambda args: {
                "ok": True,
                "items": [
                    i.__dict__
                    for i in self.memory.query(
                        kind=args.get("kind"), limit=int(args.get("limit", 10))
                    )
                ],
            },
        )

    async def on_tool_call(self, evt: V1EventEnvelope) -> None:
        tool = str(evt.payload.get("tool", ""))
        args = dict(evt.payload.get("args", {}))
        res = await self.tools.call(tool, args)
        self._write_imprint(
            "tool_call", evt.trace_id, {"tool": tool, "args": args, "result": res}
        )
        await self._emit_via_nucleus(
            event_type="cognition.tool_result",
            trace_id=evt.trace_id,
            payload={
                "tool": tool,
                "result": res,
                "tool_command_id": evt.payload.get("command_id"),
            },
            priority="normal",
            timeout_s=1.5,
            max_retries=3,
        )

    async def on_tick(self, evt: V1EventEnvelope) -> None:
        trust = 0.55 + 0.4 * random.random()
        self.perception.ingest(
            Modality.TELEMETRY,
            {"heartbeat": evt.ts_ms, "tick": True},
            self.cfg.agent_id,
            trust,
        )

        health = self.perception.get_health()

        c_out = self.consciousness.cycle(
            perception_quality=health.quality, trust_avg=health.avg_trust
        )
        self._last_consciousness = c_out

        grads = self._make_demo_gradients(health.avg_trust)
        fed = self.nfal.round(grads)
        self._last_fed = fed

        self._write_imprint(
            "tick",
            evt.trace_id,
            {
                "perception": {
                    "avg_trust": health.avg_trust,
                    "quality": health.quality,
                    "count": health.count,
                },
                "consciousness": {
                    "emergence": c_out.emergence,
                    "state": c_out.state.value,
                    "metrics": c_out.metrics.__dict__,
                    "logs": c_out.logs,
                },
                "federated": fed.__dict__,
            },
        )

        await self._emit_via_nucleus(
            event_type="cognition.status",
            trace_id=evt.trace_id,
            payload={
                "C": c_out.metrics.C,
                "eps": c_out.metrics.epsilon,
                "depth": c_out.metrics.depth,
                "ethics": c_out.metrics.ethics,
                "emergence": c_out.emergence,
                "fed_loss": fed.federated_loss,
                "coherence": fed.agent_agreement,
            },
            priority="low",
            timeout_s=1.0,
            max_retries=2,
        )

    async def on_brain_run(self, evt: V1EventEnvelope) -> None:
        bubble_health = 0.65
        branch_penalty = 0.05

        health = self.perception.get_health()
        snap = self._last_consciousness or self.consciousness.cycle(
            perception_quality=health.quality, trust_avg=health.avg_trust
        )
        fed = self._last_fed or self.nfal.round([])

        decision = self.enforcement.decide_world_spawn(
            now_ms=evt.ts_ms,
            consciousness=snap,
            federated=fed,
            bubble_health=bubble_health,
            branch_penalty=branch_penalty,
            override=False,
        )

        self._write_imprint("governance", evt.trace_id, {"decision": decision.__dict__})

        if not decision.allowed:
            await self._emit_via_nucleus(
                event_type="cognition.world_denied",
                trace_id=evt.trace_id,
                payload={"decision": decision.__dict__},
                priority="normal",
                timeout_s=1.5,
                max_retries=4,
            )
            return

        chunk = self.streaming.choose_chunk()
        proof: Dict[str, Any] = {
            "emergence": snap.emergence,
            "state": snap.state.value,
            "C": snap.metrics.C,
            "ethics": snap.metrics.ethics,
        }

        world = self.genesis.spawn_world(
            world_name=self.cfg.world_name,
            emergence_proof=proof,
            num_regions=self.cfg.spawn_regions,
            num_characters=self.cfg.spawn_characters,
            chunk=chunk,
        )

        if world is None:
            self._write_imprint(
                "world_spawn_failed",
                evt.trace_id,
                {"reason": "auth_failed_or_generation_returned_none"},
            )
            await self._emit_via_nucleus(
                event_type="cognition.world_failed",
                trace_id=evt.trace_id,
                payload={"reason": "spawn_world_returned_none"},
                priority="high",
                timeout_s=2.0,
                max_retries=6,
            )
            return

        self._write_imprint(
            "world_spawn",
            evt.trace_id,
            {
                "world_id": world.world_id,
                "world_name": world.world_name,
                "chunk": (chunk.__dict__ if chunk else None),
                "continuity": world.continuity_report,
                "constraints": world.constraints,
            },
        )

        await self._emit_via_nucleus(
            event_type="cognition.world_spawned",
            trace_id=evt.trace_id,
            payload={
                "world_id": world.world_id,
                "world_name": world.world_name,
                "region_count": len(world.regions),
                "character_count": len(world.characters),
                "constraints": world.constraints,
            },
            priority="high",
            timeout_s=2.0,
            max_retries=6,
        )

    async def _emit_via_nucleus(
        self,
        *,
        event_type: str,
        trace_id: str,
        payload: Dict[str, Any],
        priority: str = "normal",
        timeout_s: float = 2.0,
        max_retries: int = 4,
    ) -> bool:
        last_error: Optional[str] = None

        for attempt in range(1, max_retries + 2):
            cmd = make_v1_command(
                command_type="cognition.request_emit",
                ts_ms=self._now_ms(),
                trace_id=trace_id,
                payload={
                    "event_type": event_type,
                    "event_payload": payload,
                    "priority": priority,
                },
            )

            ack = await self.bus.send_command_await_acks(cmd, timeout_s=timeout_s)
            if ack.get("ok"):
                return True

            error_text = str(ack.get("error", ""))
            last_error = error_text
            overloaded = "overloaded" in error_text.lower()

            if overloaded and attempt <= max_retries:
                await asyncio.sleep(backoff_delay_s(attempt))
                continue

            if priority == "low" and overloaded:
                return False

            raise RuntimeError(f"Emit NACK for {event_type}: {ack}")

        if priority == "low" and (last_error and "overloaded" in last_error.lower()):
            return False

        raise RuntimeError(f"Emit failed for {event_type}: {last_error}")

    def _write_imprint(self, kind: str, trace_id: str, data: Dict[str, Any]) -> None:
        imp = self.memory.write(kind, trace_id, data)
        v1 = make_v1_imprint(ts_ms=imp.ts_ms, trace_id=trace_id, kind=kind, data=data)
        self._store.put_imprint(v1)

    @staticmethod
    def _now_ms() -> int:
        import time

        return int(time.time() * 1000)

    def _make_demo_gradients(self, avg_trust: float) -> List[LocalGradient]:
        dim = self.nfal.cfg.dim
        rng = random.Random(int(avg_trust * 10_000))
        grads: List[LocalGradient] = []
        for i in range(4):
            trust = max(0.0, min(1.0, avg_trust + (rng.random() - 0.5) * 0.2))
            loss = max(0.0, 0.15 + (1.0 - trust) * 0.35 + rng.random() * 0.05)
            gradient = [(rng.random() - 0.5) * 0.2 for _ in range(dim)]
            grads.append(
                LocalGradient(
                    agent_id=f"agent_{i}", trust=trust, loss=loss, gradient=gradient
                )
            )
        return grads
