"""
Wheel Curriculum Loopback Demo

Minimal end-to-end example:
  1. Load plan + state
  2. Wire loopback bus that simulates agent
  3. Run N ticks → observe tool calls and results
  4. Save state

Run with:
  python -m unified_nexus.curriculum.wheel_demo
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, cast

from ..contracts_v1_schema import make_v1_command
from ..contracts_v1_types import V1EventEnvelope
from .wheel_runtime import WheelRuntime


def now_ms() -> int:
    """Get current time in milliseconds"""
    return int(time.time() * 1000)


async def curriculum_stop_execute(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minimal deterministic agent tool implementation.
    Uses teaching_points as anchors and returns the required structured result.
    """
    stop_id = cast(str, args["stop_id"])
    points = cast(list[str], args["teaching_points"])

    explanation = [
        f"{stop_id}: This stop teaches the core distinctions and patterns you must recognize quickly.",
        "Use the teaching points as the canonical anchors, then generalize by creating your own examples.",
        "If you can pass the quick checks consistently, this stop is operationally learned.",
    ]

    examples = [
        f"Example 1: {points[0] if points else 'teaching point 1'}",
        f"Example 2: {points[1] if len(points) > 1 else (points[0] if points else 'teaching point 2')}",
        "Example 3: Apply the rule from teaching points to a sentence you invent.",
    ]

    quick_checks = [
        {
            "q": "Name the concept in point #1 in your own words.",
            "a": "A concise paraphrase that preserves meaning.",
        },
        {
            "q": "Give one fresh example not listed.",
            "a": "A valid example that matches the rule.",
        },
        {
            "q": "What's a common confusion here?",
            "a": "A typical mix-up + how to avoid it.",
        },
    ]

    common_mistake = {
        "mistake": "Memorizing labels without producing examples.",
        "fix": "For each point, generate 2 original examples and 1 counterexample.",
    }

    tags = ["curriculum", "wheel", stop_id, "learning", "practice", "checks"]

    return {
        "ok": True,
        "summary": f"{stop_id} completed",
        "explanation_3_sentences": explanation,
        "examples": examples,
        "quick_checks": quick_checks,
        "common_mistake": common_mistake,
        "tags": tags,
    }


class LoopbackBus:
    """
    Simulates Nucleus routing:
      - receives nucleus.tool_call event
      - calls the agent tool
      - emits nucleus.tool_result command back to runtime
    """

    def __init__(self, runtime: WheelRuntime):
        self.runtime = runtime
        self.call_count = 0

    async def emit_event_nucleus_only(
        self, env: V1EventEnvelope, *, caller: str
    ) -> None:
        """Handle emitted events (nucleus.tool_call in this case)"""
        if env.event_type == "nucleus.tool_call":
            self.call_count += 1
            call_id = cast(str, env.payload["call_id"])
            args = cast(dict[str, Any], env.payload["args"])

            # Simulate agent executing the tool
            result = await curriculum_stop_execute(args)

            # Send result back as nucleus.tool_result command
            cmd = make_v1_command(
                command_type="nucleus.tool_result",
                ts_ms=env.ts_ms,
                trace_id=env.trace_id,
                payload={
                    "call_id": call_id,
                    "ok": cast(bool, result.get("ok", False)),
                    "result": cast(dict[str, Any], result),
                },
            )
            await self.runtime.on_command(cmd)

        elif env.event_type in (
            "brain.curriculum.progress",
            "brain.curriculum.completed",
        ):
            # Optional: log progress
            if self.call_count % 10 == 0:
                state = self.runtime.state
                print(
                    f"  📊 Rotation {state['rotation']}/{self.runtime.plan['total_rotations']}, "
                    f"stop {state['stop_index']}/{len(self.runtime.plan['stop_order'])}, "
                    f"calls: {self.call_count}"
                )

    async def send_command(self, cmd: Any) -> None:
        """In this demo, commands are not used"""
        pass


async def main() -> None:
    """Run the demo"""
    print("🎡 Wheel Curriculum Loopback Demo")
    print("=" * 60)

    # Load plan and state
    plan = cast(
        dict[str, Any], WheelRuntime.load_json("schemas/curriculum/wheel.plan.v1.json")
    )
    state = cast(
        dict[str, Any], WheelRuntime.load_json("schemas/curriculum/wheel.state.v1.json")
    )

    print(f"\n✅ Loaded plan: {plan['title']}")
    print(f"   Stops: {len(plan['stop_order'])}")
    print(f"   Total rotations: {plan['total_rotations']}")
    print("\n✅ Loaded state:")
    print(f"   Rotation: {state['rotation']}/{plan['total_rotations']}")
    print(f"   Stop index: {state['stop_index']}/{len(plan['stop_order'])}")
    print(f"   Completed: {sum(len(v) for v in state['completed'].values())} stops")
    print(f"   History: {len(state['history'])} entries")

    # Create runtime + loopback bus
    runtime = WheelRuntime(plan=plan, state=state, bus=None)  # type: ignore
    bus = LoopbackBus(runtime)
    runtime.bus = bus

    print("\n🚀 Starting curriculum loop...")
    print("=" * 60)

    # Run a few ticks to demonstrate
    num_ticks = 15  # first 1.5 stops (10 stops per rotation)
    for i in range(num_ticks):
        await runtime.tick(ts_ms=now_ms())
        if runtime.state["rotation"] > plan["total_rotations"]:
            print("\n✅ Curriculum complete!")
            break

    print("=" * 60)
    print(f"\n✅ Demo complete after {bus.call_count} tool calls")
    print(
        f"   Final state: rotation {state['rotation']}, stop_index {state['stop_index']}"
    )
    print(f"   History entries: {len(state['history'])}")

    # Save state
    runtime.save_state_json("schemas/curriculum/wheel.state.v1.json")
    print("\n💾 State saved to wheel.state.v1.json")


if __name__ == "__main__":
    asyncio.run(main())
