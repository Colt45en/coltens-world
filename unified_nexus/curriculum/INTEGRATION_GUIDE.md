# Wheel Curriculum Integration Guide

## Overview

The Wheel Curriculum is a deterministic 100-rotation × 10-stop learning system. This guide shows how to integrate it with your Nucleus agent and EventBus.

**Core Components:**
- `WheelRuntime` (Python): Manages curriculum state, emits nucleus.tool_call events, consumes nucleus.tool_result commands
- `wheel.plan.v1.json`: Immutable curriculum definition (10 stops, 100 rotations, lesson pools)
- `wheel.state.v1.json`: Resumable session state (rotation, stop, seq counter, history)
- `curriculum.stop.execute`: Agent tool that receives teaching points and returns structured lesson

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Nucleus                                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ EventBus                                               │  │
│  │  ├─ emit_event_nucleus_only(env, caller="brain")      │  │
│  │  ├─ send_command(cmd)                                 │  │
│  │  ├─ subscribe_event(event_type, handler)              │  │
│  │  └─ register_command_handler(command_type, handler)   │  │
│  └────────────────────────────────────────────────────────┘  │
│         ↑                                          ↓          │
│    (receives result)                      (handles call)      │
│         │                                          │          │
└─────────┼──────────────────────────────────────────┼──────────┘
          │                                          │
          │                                          │
    ┌─────▼──────────────────────────────────────────▼──┐
    │ WheelRuntime (Brain)                             │
    │  ├─ tick(ts_ms)      → emit nucleus.tool_call   │
    │  ├─ on_command(cmd)  → consume nucleus.tool_result │
    │  ├─ state           → (rotation, stop_index, seq) │
    │  └─ plan            → (stops, lesson pools)      │
    └───────────────────────────────────────────────────┘
              ↓                                      ↑
         (subscribes to nucleus.tool_result)
              │                                      │
         ┌────▼──────────────────────────────────────┘
         │
    ┌────▼───────────────────────────────────────┐
    │ Agent (curriculum.stop.execute)            │
    │  ├─ Input  → stop_id, teaching_points     │
    │  ├─ Output → {ok, explanation, examples}  │
    │  └─ Handler calls tool, returns result    │
    └────────────────────────────────────────────┘
```

## Step 1: Initialize WheelRuntime

In your Nucleus brain initialization code:

```python
from unified_nexus.curriculum.wheel_runtime import WheelRuntime

# Load plan and state
plan = WheelRuntime.load_json("schemas/curriculum/wheel.plan.v1.json")
state = WheelRuntime.load_json("schemas/curriculum/wheel.state.v1.json")

# Create runtime with EventBus reference
runtime = WheelRuntime(plan=plan, state=state, bus=event_bus)

# Subscribe to tool results
event_bus.subscribe_event(
    "nucleus.tool_result",
    lambda env: runtime.on_command(env)  # Note: need async handler wrapper
)
```

## Step 2: Implement the Agent Tool Handler

The agent must implement `curriculum.stop.execute` tool:

```python
# In your agent codebase (e.g., agents/default/tools/curriculum.py)

async def curriculum_stop_execute(args: dict[str, Any]) -> dict[str, Any]:
    """
    Execute a curriculum stop.

    Args:
        stop_id: str           # e.g., "verbs", "nouns"
        teaching_points: list  # e.g., ["point 1", "point 2"]
        rotation: int          # current rotation (1-100)

    Returns:
        {
            "ok": bool,
            "summary": str,
            "explanation_3_sentences": list[str],
            "examples": list[str],
            "quick_checks": list[{"q": str, "a": str}],
            "common_mistake": {"mistake": str, "fix": str},
            "tags": list[str],
        }
    """
    stop_id = args["stop_id"]
    teaching_points = args["teaching_points"]
    rotation = args.get("rotation", 1)

    # Your implementation here
    # - Use teaching_points as anchors
    # - Generate 3-sentence explanation
    # - Create examples
    # - Formulate quick checks
    # - Surface common mistake

    return {
        "ok": True,
        "summary": f"{stop_id} completed",
        "explanation_3_sentences": [...],
        "examples": [...],
        "quick_checks": [...],
        "common_mistake": {...},
        "tags": ["curriculum", "wheel", stop_id],
    }
```

Register with agent:

```python
agent.register_tool(
    "curriculum.stop.execute",
    curriculum_stop_execute,
    input_schema={
        "type": "object",
        "properties": {
            "stop_id": {"type": "string", "description": "Curriculum stop identifier"},
            "teaching_points": {"type": "array", "items": {"type": "string"}},
            "rotation": {"type": "integer"},
        },
        "required": ["stop_id", "teaching_points"],
    }
)
```

## Step 3: Wire EventBus Handlers

Ensure WheelRuntime consumes nucleus.tool_result commands:

```python
# In Nucleus brain initialization
import asyncio

async def handle_tool_result(env: V1EventEnvelope) -> None:
    """Convert event to command and pass to runtime"""
    if env.event_type == "nucleus.tool_result":
        # Re-emit as command for runtime
        cmd = make_v1_command(
            command_type="nucleus.tool_result",
            ts_ms=env.ts_ms,
            trace_id=env.trace_id,
            payload=env.payload,
        )
        await runtime.on_command(cmd)

event_bus.subscribe_event("nucleus.tool_result", handle_tool_result)
```

## Step 4: Run the Curriculum

In your main brain loop:

```python
async def run_curriculum():
    """Main curriculum loop"""
    while True:
        # Check if curriculum is complete
        if runtime.state["rotation"] > runtime.plan["total_rotations"]:
            print("✅ Curriculum complete!")
            break

        # Emit next curriculum call
        await runtime.tick(ts_ms=int(time.time() * 1000))

        # Prevent busy loop
        await asyncio.sleep(0.1)

# Start curriculum task
asyncio.create_task(run_curriculum())
```

## Step 5: Save and Resume State

To enable resumption from checkpoints:

```python
# Periodically (e.g., after each completed stop)
runtime.save_state_json("schemas/curriculum/wheel.state.v1.json")

# On restart
state = WheelRuntime.load_json("schemas/curriculum/wheel.state.v1.json")
runtime = WheelRuntime(plan=plan, state=state, bus=event_bus)
```

## Contract Compliance

### V1 Event Envelope

WheelRuntime emits `nucleus.tool_call` events:

```json
{
  "v": 1,
  "event_type": "nucleus.tool_call",
  "ts_ms": 1704067200000,
  "trace_id": "trace_learning-wheel",
  "seq": 1,
  "payload": {
    "call_id": "call_rotation_1_stop_verbs_abc123...",
    "tool_name": "curriculum.stop.execute",
    "args": {
      "stop_id": "verbs",
      "teaching_points": ["point 1", "point 2"],
      "rotation": 1
    }
  },
  "event_id": "event_sha256_hash..."
}
```

### V1 Command Envelope

Agent/Nucleus emits `nucleus.tool_result` commands:

```json
{
  "v": 1,
  "command_type": "nucleus.tool_result",
  "ts_ms": 1704067201000,
  "trace_id": "trace_learning-wheel",
  "payload": {
    "call_id": "call_rotation_1_stop_verbs_abc123...",
    "ok": true,
    "result": {
      "ok": true,
      "summary": "verbs completed",
      "explanation_3_sentences": [...],
      "examples": [...],
      "quick_checks": [...],
      "common_mistake": {...},
      "tags": [...]
    }
  },
  "command_id": "cmd_sha256_hash..."
}
```

**Key Fields:**
- `call_id`: Deterministically generated from (rotation, stop_id, stop_index) via content_hash_id()
- `seq`: Monotone counter incremented on each emit (persisted in state)
- `trace_id`: Fixed per session ("trace_learning-wheel"), shared across all events
- All IDs use SHA256 content hashing for reproducibility

## Resumption Semantics

The curriculum can be resumed from any checkpoint:

1. **Determine checkpoint**: Load wheel.state.v1.json
2. **Validate state**: Check rotation < total_rotations, stop_index < len(stop_order)
3. **Restore seq**: Continue from saved seq counter (guarantees monotone event IDs)
4. **Restore trace_id**: Same trace_id for all events in session
5. **Regenerate picks**: Pool picks are deterministic (same seed + rotation = same picks)

Example:

```python
# Session 1: Rotation 1, Stop 0 (verbs)
state["seq"] = 5
state["rotation"] = 1
state["stop_index"] = 0

# ... emit nucleus.tool_call with seq=6, 7, 8, ...

# Save state: seq=10, rotation=1, stop_index=1

# Session 2 restart (next day):
state["seq"] = 10  # Continue from 10
state["rotation"] = 1  # Resume at rotation 1
state["stop_index"] = 1  # Skip completed verbs

# ... emit nucleus.tool_call with seq=11, 12, 13, ...
```

## Testing

Run the loopback demo:

```bash
cd "coltens world"
python -m unified_nexus.curriculum.wheel_demo
```

Run integration tests:

```bash
pytest unified_nexus/curriculum/test_wheel_runtime.py -v
```

## Files Reference

| File | Purpose |
|------|---------|
| `unified_nexus/curriculum/wheel_runtime.py` | Brain curriculum orchestrator (387 lines) |
| `schemas/curriculum/wheel.plan.v1.json` | Immutable plan (10 stops, 100 rotations, pools) |
| `schemas/curriculum/wheel.state.v1.json` | Resumable session state |
| `unified_nexus/curriculum/wheel_demo.py` | Loopback demo with simulated agent |
| `unified_nexus/curriculum/test_wheel_runtime.py` | Integration tests |
| `unified_nexus/curriculum/__init__.py` | Package exports (WheelRuntime) |

## Troubleshooting

### State validation fails

Check that `wheel.state.v1.json` has:
- `version: "wheel.state.v1"`
- `wheel_id` matches plan
- `rotation < total_rotations`
- `stop_index < len(stop_order)`
- `seq >= 0`

### Tool calls not being routed

Verify EventBus is properly wired:
- WheelRuntime.bus reference is set
- nucleusEventBus.emit_event_nucleus_only() is called
- Agent is subscribed to nucleus.tool_call events

### Results not advancing state

Check that:
- nucleus.tool_result command includes matching `call_id`
- command_type is "nucleus.tool_result"
- trace_id matches session

### Seq counter out of order

Ensure:
- State is saved/loaded correctly (persisted seq value)
- No concurrent tick() calls (use asyncio.Lock if needed)
- State is not reset between calls

## Future Extensions

- [ ] Multi-rotation batching (emit N tool_calls for parallel execution)
- [ ] Pool difficulty scaling (increase complexity per rotation)
- [ ] Adaptive pacing (adjust delays based on performance)
- [ ] Visualization (curriculum progress dashboard)
- [ ] Export to LRS (Learning Record Store) via xAPI
