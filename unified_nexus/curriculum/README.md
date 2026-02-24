# ✨ Wheel Curriculum System

**Deterministic, resumable learning loop** with **100 rotations** of 10 core concepts.

Designed to plug directly into your **Brain/Nucleus/Agent** architecture via the EventBus, emitting `nucleus.tool_call` and consuming `nucleus.tool_result` events.

---

## 📋 Quick Start

### 1. **Files Created**

```
unified_nexus/
  contracts/
    wheel_curriculum_v1_types.py    ← Type contracts
  curriculum/
    __init__.py
    wheel_runtime.py                ← Python Brain runtime
    WHEEL_INTEGRATION_GUIDE.md      ← Full integration guide

schemas/curriculum/
  wheel.plan.v1.json                ← Curriculum data (10 stops × 100 rotations)
  wheel.state.v1.json               ← Initial state (fresh start)

apps/nucleus/src/curriculum/
  __init__.ts
  wheelRuntime.ts                   ← TypeScript adapter
```

### 2. **Wire into Your Nucleus**

In your orchestrator startup:

```python
from unified_nexus.curriculum import WheelRuntime

# Load plan + state
plan = WheelRuntime.load_plan("schemas/curriculum/wheel.plan.v1.json")
state = WheelRuntime.load_state("schemas/curriculum/wheel.state.v1.json")

# Create runtime
wheel = WheelRuntime(plan, state, bus)

# Subscribe to tool results
bus.subscribe_event("nucleus.tool_result", wheel.on_tool_result)

# Main loop
async for _ in asyncio.count():
    await wheel.tick(caller="brain")
    wheel.save_state("schemas/curriculum/wheel.state.v1.json")
    await asyncio.sleep(0.1)  # let EventBus process
```

### 3. **Implement Agent Tool**

Your agent must implement `curriculum.stop.execute`:

```python
async def handle_curriculum_stop_execute(cmd: V1CommandEnvelope) -> Dict[str, object]:
    args = cmd.payload  # CurriculumStopExecuteInput

    # Your agent logic: read args.prompt and args.teaching_points
    # Generate lesson following the required structure

    return {
        "ok": True,
        "summary": "...",
        "explanation_3_sentences": [...],
        "examples": [...],
        "quick_checks": [...],
        "common_mistake": {...},
        "tags": [...],
    }

bus.register_command_handler("curriculum.stop.execute", handle_curriculum_stop_execute)
```

---

## 🎡 How It Works

### **Rotation 1** (Pinned Content)
- All 10 stops use `loop1_points` — core concepts you wrote exactly as intended
- Brain → `nucleus.tool_call` with pinned lessons
- Agent → `nucleus.tool_result` with structured understanding
- Brain records completion, advances to next stop

### **Rotations 2–100** (Pool Picks)
- Each stop randomly selects from `lesson_pool` (deterministic RNG)
- **Anti-repeat guarantee**: No lesson repeated within 3 rotations
- Seeded by `wheel_id + stop_id + rotation` → always same picks for same (rotation, stop)
- Perfect for resumption: load state, deterministic restart

### **Completion**
- After 100 rotations (1000 stops), emits `brain.curriculum.completed`
- History tracked: `state.history[i]` = `{rotation, stop_id, call_id, ok, summary}`

---

## 📊 State & Resumption

The wheel is **fully resumable**. If Nucleus crashes:

1. Load state from `wheel.state.v1.json` (contains rotation, stop_index, completed, etc.)
2. Recreate `WheelRuntime(plan, state, bus)`
3. Resume with `await wheel.tick()` → picks up exactly where you were
4. Pool picks are deterministic: same `(rotation, stop_id)` → same picks

**No human intervention needed.**

---

## 🔍 Guardian Invariants

The plan includes constraints your agent can assert:

```json
"guardian_invariants": [
  "Stop order must follow stop_order list",
  "Rotation must be within [1..total_rotations]",
  "A stop cannot be completed twice in the same rotation",
  "Tool results must match the active call_id to advance"
]
```

Your agent receives these in `args.guardian_invariants` and can validate them.

---

## 📂 The 10 Stops (One Full Wheel)

1. **verbs** — Action, linking, helping, transitive/intransitive, regular/irregular
2. **nouns** — Common/proper, concrete/abstract, countable/uncountable, possessive, collective
3. **grammar** — Subject-verb agreement, tenses, punctuation, sentence structure
4. **deduction** — Premises → conclusion, fallacies, syllogisms
5. **perception** — Literal vs. inferential, bias, multi-sensory
6. **focus** — Distractions, deep work, endurance
7. **memory** — Chunking, mnemonics, spaced repetition
8. **symbols** — Semiotics, cultural vs. universal, literary
9. **perspective** — First/third person, empathy, reframing
10. **imagination** — Innovation, creative problem-solving, design

Each stop has:
- **loop1_points**: Core concepts (rotation 1)
- **lesson_pool**: Extra lessons to draw from (rotations 2+)

---

## 🎯 Event Flow

```
Brain.tick()
  → plan + state → compile stop payload
  → emit nucleus.tool_call { tool: "curriculum.stop.execute", args: {...} }
  → state.active_call = {call_id, stop_id, rotation}

[Nucleus routes to Agent]

Agent (your curriculum.stop.execute handler)
  → read args.prompt + args.teaching_points
  → generate lesson
  → return curriculum.stop.execute.result.v1

[Nucleus emits nucleus.tool_result]

Brain.on_tool_result()
  → validate call_id matches active_call
  → mark state.completed[rotation][stop_id] = true
  → record state.history
  → clear state.active_call
  → advance to next stop
  → emit brain.curriculum.progress

Brain.tick()  [next iteration]
  → repeat until state.rotation > 100
```

---

## 🔮 Determinism Guarantee

For all 100 rotations, **same output structure on same input**:

```python
# Deterministic RNG (mulberry32)
seed = mutation_policy.seed ^ hash(f"{wheel_id}:{stop_id}:{rotation}")
rng = mulberry32(seed)
# Same seed → same pool picks → same lesson order
```

Anti-repeat logic ensures variety:

```python
blocked = {
  item
  for item in recent_pool_picks[stop_id]
  if rotation - item.rotation <= no_repeat_within_last_rotations  # 3
}
```

---

## 📖 Full Integration Guide

See **[WHEEL_INTEGRATION_GUIDE.md](WHEEL_INTEGRATION_GUIDE.md)** for:
- Complete Python setup code
- Agent tool handler example
- Resumption example
- Testing helpers
- Fast-forward simulation

---

## 🏗️ Type Contracts

All types live in `unified_nexus/contracts/wheel_curriculum_v1_types.py`:

- `V1WheelPlan` — Immutable curriculum
- `V1WheelState` — Mutable session (rotation, stop_index, completed, history)
- `CurriculumStopExecuteInput` — Agent input
- `CurriculumStopExecuteResult` — Agent output
- `CurriculumToolCallPayload`, `CurriculumToolResultPayload` — Event envelopes

---

## 🚀 Next Steps

1. **Initialize** in your Nucleus startup
2. **Register** agent handler `curriculum.stop.execute`
3. **Loop** with `await wheel.tick()` and `wheel.on_tool_result()`
4. **Persist** state with `wheel.save_state()`
5. **Monitor** via `brain.curriculum.progress` / `brain.curriculum.completed` events

---

## ✅ Deliverables

- ✅ Deterministic plan for 100 rotations
- ✅ Resumable state file
- ✅ Python Brain runtime (plan + state orchestrator)
- ✅ TypeScript adapter for Nucleus
- ✅ Agent tool contract
- ✅ Type contracts matching your envelope spec
- ✅ Integration guide + examples

**Everything you need to run 100 deterministic rotations without manual editing.**

The wheel is ready. 🎡

---

## Questions?

See [WHEEL_INTEGRATION_GUIDE.md](WHEEL_INTEGRATION_GUIDE.md) for detailed examples, debugging, and fast-forward simulation.
