# NEXUS Build: Next Module Selection

## ✅ World Core v1 Shipped

**Commit: `9cc40a4`**

Delivered:
- RFC 8785 canonical JSON + SHA-256 (determinism substrate)
- Mesh Style Spec + validator (asset discipline)
- Prefab System (Avatar/Building) + baker (composition engine)
- World Snapshot + replay (time machine)
- Content-addressed artifact store
- Ledger events for all operations (audit trail)
- 18 integration tests proving determinism
- All Nucleus tool routes wired

**Status:** ✅ TypeScript strict, ✅ Contracts valid, ✅ Tests ready, ✅ Ready for next module

---

## 📍 Nexus Build Spine Status

Completed:
1. ✅ **Mesh Style Spec + Validator**
2. ✅ **Prefab System + Baker**
3. ✅ **World Snapshot/Replay**

Pending (in recommendation order):
4. **Physics Stepper** (fixed dt, deterministic, Rapier JS/WASM cross-platform)
5. **Graphics Intent → Render** (scene intent objects, deterministic vertex/texture binding)
6. **Chat Engine** (event stream, ledgered, tied to world actors/locations)
7. **Local Lexicon** (SQLite storage with determinism rules + SQLite versioning discipline)
8. **Automation** (job scheduling, run reports with deterministic execution context)

---

## 🎯 Pick Your Next Module

### Option 1: Physics Stepper
**Best for:** Making the world interactive (gravity, collisions, dynamics)

Files created:
- `packages/engine/src/contracts/physics/{step_input,step_output,snapshot}.ts`
- `packages/engine/src/physics/stepper.ts` (fixed dt, Rapier integration)
- `packages/engine/src/physics/determinism.ts` (trig lookup table, WASM Math.sin alternatives)
- `apps/nucleus/src/routes/physics.ts` (physics.step.v1, physics.snapshot.v1)
- Integration tests: batched stepping, snapshot replay determinism

**Contract scope:**
```
physics.step.input.v1 { world_snapshot, dt_ms, forces:[ {actor_id, force_vector} ] }
physics.step.output.v1 { new_snapshot, impulses_applied, collision_events }
physics.snapshot.v1 { actor_positions, velocities, world_tick }
```

**Determinism guarantee:** Same world state + same inputs → identical impulses + positions (within quantization)

---

### Option 2: Graphics Intent → Render
**Best for:** Visual representation (scene composition, material binding, viewport)

Files created:
- `packages/engine/src/contracts/graphics/{scene_intent,frame_intent,resource_binding}.ts`
- `packages/engine/src/graphics/composer.ts` (scene from snapshot + physics state)
- `packages/engine/src/graphics/renderer.ts` (intent → WebGL bindings)
- `apps/nucleus/src/routes/graphics.ts` (graphics.compose.v1, graphics.render.v1)
- Integration tests: same state → same scene intent, same intent → same bindings

**Contract scope:**
```
graphics.scene_intent.v1 { tick, viewport, camera, nodes:[{mesh_id, material_id, transform}] }
graphics.frame_intent.v1 { scene_hash, resource_bindings:[{texture_id, artifact_hash}], viewport }
```

**Determinism guarantee:** Same world state → identical scene intent (order stable, transforms canonical)

---

### Option 3: Chat Engine
**Best for:** In-world messaging (actors, channels, replay)

Files created:
- `packages/engine/src/contracts/chat/{message,channel,append,session}.ts`
- `packages/engine/src/chat/ledger.ts` (append-only message stream, deterministic ordering)
- `packages/engine/src/chat/replay.ts` (reconstruct conversation from ledger)
- `apps/nucleus/src/routes/chat.ts` (chat.channel.create.v1, chat.message.append.v1, chat.replay.v1)
- Integration tests: same ledger events → identical replay

**Contract scope:**
```
chat.message.v1 { channel_id, from_actor_id, text, timestamp, sequence }
chat.append.v1 { channel_id, from_actor_id, text } → { message_hash, ledger_event }
chat.replay.v1 { channel_id, start_seq, end_seq } → { messages:[...], transcript_hash }
```

**Determinism guarantee:** Same ledger events → identical transcript (order is sequence number)

---

### Option 4: Local Lexicon
**Best for:** Semantic storage (definitions, relationships, query)

Files created:
- `packages/engine/src/contracts/lexicon/{entry,chain,query,store_schema}.ts`
- `packages/engine/src/lexicon/store.ts` (SQLite with determinism pragmas + versioning)
- `packages/engine/src/lexicon/query.ts` (deterministic SQL generation, stable result ordering)
- `apps/nucleus/src/routes/lexicon.ts` (lexicon.entry.create.v1, lexicon.query.v1)
- Integration tests: deterministic SQL, versioned PRAGMA set, stable result ordering

**Contract scope:**
```
lexicon.entry.v1 { id, text, definitions:[...], relationships:[...] }
lexicon.query.v1 { text_pattern, filters } → { results, ordered_by: "entry_id|relevance" }
```

**Determinism guarantee:** Same DB + same query → identical result order (specified in contract)

---

### Option 5: Automation (Jobs + Scheduling)
**Best for:** Background tasks (scheduled runs, reports, audit trail)

Files created:
- `packages/engine/src/contracts/automation/{job,schedule,run_report}.ts`
- `packages/engine/src/automation/scheduler.ts` (deterministic job execution with context)
- `packages/engine/src/automation/executor.ts` (replay safe with input hash binding)
- `apps/nucleus/src/routes/automation.ts` (automation.job.create.v1, automation.run.v1)
- Integration tests: same job + same inputs → same report_hash

**Contract scope:**
```
automation.job.v1 { job_id, trigger: "interval"|"event", handler_id, config_hash }
automation.run_report.v1 { job_id, started_at, ended_at, input_hash, output_hash, status }
```

**Determinism guarantee:** Same job inputs → identical execution signature + output hash

---

## 🚀 Recommendation

**Start with Physics (Option 1)** because:
1. World Core snapshot becomes immediately useful (physics reads from snapshot, writes new one)
2. Deterministic stepping is the "hardest" problem (Rapier + cross-platform trig)
3. Physics output feeds directly into Graphics (tight feedback loop)
4. Chat + Lexicon can wait until world has "things to talk about"

**Then Graphics (Option 2)** to visualize physics.

**Then Chat + Lexicon** for semantic depth.

---

## 📝 How to Proceed

Say one of:
- **"generate Physics Stepper (Option 1)"**
- **"generate Graphics Intent (Option 2)"**
- **"generate Chat Engine (Option 3)"**
- **"generate Local Lexicon (Option 4)"**
- **"generate Automation (Option 5)"**

Or **"implement all 5"** to ship the complete World Engine skeleton in one session.

Each module follows the **same NEXUS discipline:**
- Contracts locked first
- Determinism baked in
- Ledger events for audit
- Nucleus routes wired
- Integration tests proving replay

---

## Immediate Status

✅ Ready to generate next module on demand
✅ All World Core files committed
✅ TypeScript strict mode maintained
✅ Determinism tests as baseline

**Awaiting your selection → Agent generates, typechecks, tests, commits.**
