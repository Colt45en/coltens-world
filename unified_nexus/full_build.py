from __future__ import annotations

import asyncio
from contextlib import suppress

from .event_bus import EventBus
from .contracts_v1_types import V1EventEnvelope
from .nucleus.nucleus import Nucleus, NucleusConfig
from .cognition import CognitionLane, CognitionConfig


async def main() -> None:
    bus = EventBus(max_event_q=10_000, max_cmd_q=1_000)

    CognitionLane(bus, CognitionConfig(
        agent_id="cognition.main",
        world_name="Nexus-Prime",
        spawn_regions=3,
        spawn_characters=5,
    ))

    nucleus = Nucleus(bus, NucleusConfig(
        tick_interval_s=0.5,
        tick_timeout_s=1.0,
        brain_run_interval_s=2.0,
        brain_run_timeout_s=5.0,
        cmd_soft_watermark=0.60,
        cmd_hard_watermark=0.85,
    ))

    async def print_status(evt: V1EventEnvelope) -> None:
        await asyncio.sleep(0)
        s = evt.payload
        print(
            f"[status] emergence={s['emergence']} C={s['C']:.1f} eps={s['eps']:.3f} "
            f"ethics={s['ethics']:.2f} coherence={s['coherence']:.2f} loss={s['fed_loss']:.3f}"
        )

    async def print_world(evt: V1EventEnvelope) -> None:
        await asyncio.sleep(0)
        p = evt.payload
        print(
            f"[world] {p.get('world_name')} id={p.get('world_id')} regions={p.get('region_count')} "
            f"chars={p.get('character_count')} constraints={p.get('constraints')}"
        )

    async def tool_results(evt: V1EventEnvelope) -> None:
        await asyncio.sleep(0)
        print(f"[tool_result] {evt.payload}")

    bus.subscribe_event("cognition.status", print_status)
    bus.subscribe_event("cognition.world_spawned", print_world)
    bus.subscribe_event("cognition.tool_result", tool_results)

    async def tool_pinger():
        while True:
            await asyncio.sleep(3.0)
            add_ack = await nucleus.call_tool("add", {"a": 2, "b": 40})
            query_ack = await nucleus.call_tool("imprint_query", {"kind": "world_spawn", "limit": 2})
            if not add_ack.get("ok"):
                print(f"[tool_ack_nack] {add_ack}")
            if not query_ack.get("ok"):
                print(f"[tool_ack_nack] {query_ack}")

    runner = asyncio.gather(
        nucleus.start(),
        tool_pinger(),
    )

    try:
        await asyncio.sleep(12.0)
    finally:
        nucleus.shutdown()
        runner.cancel()
        with suppress(asyncio.CancelledError):
            await runner


if __name__ == "__main__":
    asyncio.run(main())
