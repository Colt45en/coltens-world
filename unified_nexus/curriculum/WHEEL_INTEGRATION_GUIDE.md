"""
Wheel Curriculum Integration Guide

Complete example of wiring the Wheel Curriculum system into your Nucleus orchestration.
This shows both Python (Brain) and TypeScript (Nucleus event routing) integration.

=============================================================================
ARCHITECTURE OVERVIEW
=============================================================================

Brain (unified_nexus/curriculum/wheel_runtime.py)
  ↓ owns plan + state
  ↓ emits nucleus.tool_call
  ↓ consumes nucleus.tool_result

EventBus (unified_nexus/event_bus.py)
  ↓ routes events
  ↓ connects Brain → Agent

Agent (your implementation)
  ↓ implements curriculum.stop.execute tool
  ↓ emits nucleus.tool_result with structured lesson

=============================================================================
PYTHON INTEGRATION (Nucleus setup)
=============================================================================

Example async orchestration loop:

```python
import asyncio
from pathlib import Path
from unified_nexus.event_bus import EventBus
from unified_nexus.curriculum.wheel_runtime import WheelRuntime

async def setup_curriculum(bus: EventBus):
    '''Initialize wheel curriculum at Nucleus startup'''

    plan_path = Path("schemas/curriculum/wheel.plan.v1.json")
    state_path = Path("schemas/curriculum/wheel.state.v1.json")

    # Load plan (immutable, never reload)
    plan = WheelRuntime.load_plan(plan_path)

    # Load state (can restore from checkpoint)
    state = WheelRuntime.load_state(state_path)

    # Create runtime
    wheel = WheelRuntime(plan, state, bus)

    # Subscribe to tool results
    bus.subscribe_event("nucleus.tool_result", wheel.on_tool_result)

    return wheel


async def curriculum_loop(wheel: WheelRuntime, state_path: Path):
    '''Main loop: tick → emit → wait for result → tick again'''

    for iteration in range(1000):  # safety limit
        await wheel.tick(caller="brain")

        # Check if complete
        if wheel.getState().rotation > wheel.plan.total_rotations:
            print(f"✅ Curriculum complete after {len(wheel.getState().history)} stops")
            break

        # If waiting for tool result, don't tick again immediately
        if wheel.getState().active_call is not None:
            # Let the bus/agent process the tool_call
            # When nucleus.tool_result arrives, on_tool_result will be called
            # and active_call will be cleared
            await asyncio.sleep(0.1)

        # Persist state every stop (optional: only on completion)
        wheel.save_state(state_path)


async def main():
    # Initialize bus
    bus = EventBus(max_event_q=10_000, max_cmd_q=2_000)

    # Setup curriculum
    wheel = await setup_curriculum(bus)

    # Run orchestrator loop
    stop_event = asyncio.Event()
    tasks = [
        asyncio.create_task(bus.run_forever(stop_event=stop_event)),
        asyncio.create_task(curriculum_loop(wheel, Path("schemas/curriculum/wheel.state.v1.json")))
    ]

    try:
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
        for task in done:
            exc = task.exception()
            if exc:
                raise exc
    finally:
        stop_event.set()


if __name__ == "__main__":
    asyncio.run(main())
```

=============================================================================
AGENT TOOL HANDLER (Your Agent Implementation)
=============================================================================

The agent receives a curriculum.stop.execute tool call and must return:

```python
async def handle_curriculum_stop_execute(cmd: V1CommandEnvelope) -> Dict[str, object]:
    '''
    Agent tool handler for curriculum.stop.execute.

    Receives:
        cmd.payload = CurriculumStopExecuteInput (validated by nucleus)

    Must return:
        Dict (becomes nucleus.tool_result.payload.result)
    '''

    from unified_nexus.contracts.wheel_curriculum_v1_types import (
        CurriculumStopExecuteResult,
        QuickCheck,
        CommonMistake,
    )

    args = cmd.payload  # CurriculumStopExecuteInput

    # Your agent logic:
    # 1. Read args.prompt
    # 2. Read args.teaching_points (the lesson anchors)
    # 3. Generate educational content following the structure
    # 4. Validate against args.guardian_invariants (optional)

    explanation = generate_3_sentence_explanation(args.teaching_points)
    examples = generate_3_examples(args.stop_id, args.teaching_points)
    checks = generate_3_quick_checks(args.stop_id)
    mistake = generate_common_mistake_and_fix(args.stop_id)
    tags = generate_tags(args.stop_id, args.teaching_points)

    result = CurriculumStopExecuteResult(
        ok=True,
        summary=f"Completed {args.stop_label} (rotation {args.rotation})",
        explanation_3_sentences=explanation,
        examples=examples,
        quick_checks=[QuickCheck(q=q, a=a) for q, a in checks],
        common_mistake=CommonMistake(mistake=mistake[0], fix=mistake[1]),
        tags=tags,
    )

    return asdict(result)  # Convert dataclass to dict for JSON serialization


# Register with bus during agent setup:
bus.register_command_handler("curriculum.stop.execute", handle_curriculum_stop_execute)
```

=============================================================================
EVENT FLOW (Detailed Sequence)
=============================================================================

1. Brain.tick() called
   → Builds tool_args from compiled stop
   → Emits nucleus.tool_call event
   → Sets state.active_call = {call_id, stop_id, rotation}

2. Nucleus routes nucleus.tool_call to Agent
   → Agent receives curriculum.stop.execute command
   → Agent generates lesson content
   → Agent returns structured result

3. Agent emits nucleus.tool_result
   → call_id matches active_call.call_id
   → result contains CurriculumStopExecuteResult

4. Brain.on_tool_result() called
   → Validates call_id matches active_call
   → Marks state.completed[rotation][stop_id] = true
   → Tracks recent pool picks (for anti-repeat)
   → Records in state.history
   → Clears state.active_call
   → Advances to next stop
   → Emits brain.curriculum.progress event

5. Loop: tick() called again
   → Emits next nucleus.tool_call
   → If rotation > total_rotations: emits brain.curriculum.completed

=============================================================================
RESUMPTION (Checkpoint/Restore)
=============================================================================

The wheel is deterministic and resumable:

```python
# On Nucleus crash/restart:

# 1. Load state from file (contains rotation, stop_index, completed)
state = WheelRuntime.load_state("schemas/curriculum/wheel.state.v1.json")

# 2. State tracks exactly where you were:
#    - rotation: which cycle (1-100)
#    - stop_index: which stop in that cycle (0-9)
#    - completed[rotation][stop_id]: which stops this rotation are done
#    - active_call: if not None, we were waiting for this call_id

# 3. Recreate wheel, re-subscribe handlers, resume tick()
plan = WheelRuntime.load_plan("schemas/curriculum/wheel.plan.v1.json")
wheel = WheelRuntime(plan, state, bus)
bus.subscribe_event("nucleus.tool_result", wheel.on_tool_result)
await curriculum_loop(wheel, state_path)

# The wheel picks up exactly where it left off.
# Pool picks are deterministic (same seed + rotation = same picks).
# No manual intervention needed.
```

=============================================================================
DETERMINISM GUARANTEES
=============================================================================

For 100 rotations (1000 stops total), the curriculum is:

1. **Deterministic Lessons**
   - Rotation 1: Always uses loop1_points (pinned content)
   - Rotation 2+: Pool picks determined by mulberry32(seed ^ hash(wheel_id:stop_id:rotation))
   - Same rotation/stop always gets same pool picks

2. **Anti-Repeat Guarantee**
   - Recent pool picks tracked per stop
   - mutation_policy.no_repeat_within_last_rotations ensures variety
   - E.g., if you picked "X" in rotation 5, seen again only after rotation 8+

3. **Immutable Plan**
   - wheel.plan.v1.json never changes during curriculum
   - Seed fixed (1337)
   - All variation comes from seeded RNG, not external randomness

4. **Resumable State**
   - wheel.state.v1.json can be restored to any checkpoint
   - Next stop always emerges deterministically from loaded state
   - No race conditions in pool picking

=============================================================================
TESTING / DEBUGGING
=============================================================================

Check state at any point:

```python
state = wheel.getState()
print(f"Rotation: {state.rotation}/{wheel.plan.total_rotations}")
print(f"Stop: {state.stop_index}/{len(wheel.plan.stop_order)}")
print(f"Completed: {state.completed}")
print(f"History entries: {len(state.history)}")
print(f"Active call: {state.active_call}")
```

Simulate a full cycle (for testing):

```python
async def test_one_rotation():
    '''Simulate 10 stops (1 full rotation)'''
    wheel = WheelRuntime(plan, state, MockBus())

    for i in range(10):
        await wheel.tick()
        assert wheel.getState().active_call is not None

        # Simulate agent success
        call_id = wheel.getState().active_call["call_id"]
        result_env = V1EventEnvelope(
            v=1,
            event_type="nucleus.tool_result",
            ts_ms=int(time.time() * 1000),
            trace_id=str(uuid4()),
            seq=0,
            event_id=str(uuid4()),
            payload={
                "call_id": call_id,
                "ok": True,
                "result": {"summary": f"Stop {i+1} done"},
            }
        )
        await wheel.on_tool_result(result_env)

    # Should be at rotation 2, stop_index 0
    assert wheel.getState().rotation == 2
    assert wheel.getState().stop_index == 0
```

=============================================================================
DEBUGGING: NO STOPS JUST MOMENTUM 😄
=============================================================================

If you want maximum throughput (simulate all 100 rotations):

```python
async def all_rotations_fast():
    '''Fast-forward through all rotations (no real learning, just mechanics)'''
    for rotation in range(1, 101):
        for stop_idx, stop_id in enumerate(wheel.plan.stop_order):
            if rotation == 1:
                points = wheel.plan.stops[stop_id].loop1_points
            else:
                points = pick_pool_items(wheel.plan, wheel.getState(), stop_id)

            # Simulate agent completing this stop instantly
            call_id = str(uuid4())
            result = {
                "ok": True,
                "summary": f"Rotation {rotation} {stop_id} done",
                "explanation_3_sentences": ["x", "y", "z"],
                "examples": ["a", "b", "c"],
                "quick_checks": [],
                "common_mistake": {"mistake": "x", "fix": "y"},
                "tags": ["tag"],
            }

            # Record directly (bypass the event bus)
            wheel.getState().history.append({
                "rotation": rotation,
                "stop_id": stop_id,
                "call_id": call_id,
                "ok": True,
                "summary": result["summary"],
            })

    wheel.saveState("wheel.state.v1.json")
    print(f"✅ Simulated {len(wheel.getState().history)} stops")
```

=============================================================================
FILES CREATED
=============================================================================

1. unified_nexus/contracts/wheel_curriculum_v1_types.py
   → Type contracts for plan, state, agent input/output

2. unified_nexus/curriculum/wheel_runtime.py
   → Python Brain runtime (Plan + State orchestrator)

3. apps/nucleus/src/curriculum/wheelRuntime.ts
   → TypeScript adapter for Nucleus event routing

4. schemas/curriculum/wheel.plan.v1.json
   → Curriculum data (10 stops × 100 rotations)

5. schemas/curriculum/wheel.state.v1.json
   → Initial state (rotation 1, stop 0, empty history)

6. (This file)
   → Integration guide + examples

=============================================================================
NEXT STEPS
=============================================================================

1. Copy the Python setup code above into your Nucleus orchestrator
2. Implement handle_curriculum_stop_execute in your agent
3. Register the handler with bus.register_command_handler()
4. Call curriculum_loop() in your main asyncio.run()
5. Optionally wire brain.curriculum.progress/completed to your telemetry

The wheel will run deterministically for 100 rotations without manual intervention.
"""


# Example minimal test for validation:

if __name__ == "__main__":
    import sys
    from pathlib import Path

    # Just check that files load correctly
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

    from unified_nexus.curriculum.wheel_runtime import WheelRuntime

    plan_path = Path("schemas/curriculum/wheel.plan.v1.json")
    state_path = Path("schemas/curriculum/wheel.state.v1.json")

    if plan_path.exists() and state_path.exists():
        plan = WheelRuntime.load_plan(plan_path)
        state = WheelRuntime.load_state(state_path)

        print(f"✅ Loaded plan: {plan.title} ({plan.total_rotations} rotations, {len(plan.stop_order)} stops)")
        print(f"✅ Loaded state: rotation {state.rotation}, stop_index {state.stop_index}")
        print(f"   Completed: {len(state.completed)}")
        print(f"   History: {len(state.history)}")
        print("\n✅ Wheel curriculum ready to integrate!")
    else:
        print("❌ Plan or state files not found")
        print(f"   Try: python -m unified_nexus.curriculum.wheel_runtime")
