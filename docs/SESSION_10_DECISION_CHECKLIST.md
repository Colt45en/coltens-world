# Action Checklist: Audit Lock-Down (Session 10 Decisions)

**Goal**: Decide priorities. You decide → I apply patches immediately.

---

## 🎯 Critical Path (Do These Today)

### Decision 1️⃣ — Memory Publishing Model

**Question**: Should Sidecar publish memory events to the bus?

```
Option A: REST-only (current reality)
├─ No code changes
├─ IDE polls: GET /brain/memory/facts every 2s
├─ Memory updates are silent (not broadcast)
└─ Trade-off: Simple now, stale data feel

Option B: Event-driven (best UX)
├─ Add bus publishing to routes_memory.py
├─ Sidecar emits: memory.fact.updated → Nucleus → IDE live
├─ IDE MemoryPanel updates instantly on brain changes
└─ Trade-off: +20 LOC, better UX, real-time signaling

Which? (A / B)
```

**My recommendation**: **B** — Brain continuity + live panels feels professional.

---

### Decision 2️⃣ — iframe Security Patch

**Question**: Allow iframe to send postMessages to IDE?

```
Current: No validation at all
├─ Malicious iframe inside `/apps/bad-app` could:
│  ├─ Spoof operator results
│  ├─ Inject fake state updates
│  └─ Trigger unprotected IDE actions
└─ Risk: 🔴 CRITICAL

Proposed: Origin + message type allowlist
├─ Only localhost:5174 (preview) can send messages
├─ Only preview.input.* and preview.ping messages allowed
├─ All else: rejected with console.warn
└─ Risk: 🟢 BLOCKED

Apply patch? (Yes / No / Review first)
```

**My recommendation**: **Yes** — This is a security hole. 30-minute patch, zero regression.

---

### Decision 3️⃣ — Canonical WS Endpoint Documentation

**Question**: Document that IDE MUST use `ws://localhost:3000` (hub), not `/ws/bus`?

```
Current: No guard rails
├─ Dev could accidentally wire IDE to /ws/bus
├─ Would bypass rate limiting, nonce validation, role gating
└─ Hard to detect (code runs, just insecure)

Proposed: Add header comment to nucleus/src/index.ts
├─ Explains two endpoints: Hub (IDE) vs Bus (tools)
├─ Makes it explicit: "IDE USES ONLY ws://localhost:3000"
└─ 10-minute doc patch, prevents future accidents

Apply patch? (Yes / No)
```

**My recommendation**: **Yes** — Insurance against dev error.

---

## 🔄 Medium Priority (This Week)

### Decision 4️⃣ — Verify IDE WsClient

**Question**: Does IDE's `wsClient.ts` actually use hub WS?

```
Current: Need to check
├─ If it's using /ws/bus, we need to rewire
├─ If it's using 3000, verify in code
└─ 15-minute verification + potential 30-minute fix

I'll:
✓ Read IDE's WsClient
✓ Verify it's using ws://localhost:3000
✓ If not, create patch
└─ Tell you results

Approve verification? (Yes)
```

**My recommendation**: **Yes, verify now** — Could block other work.

---

### Decision 5️⃣ — Persistence Layer for Brain Memory

**Question**: Should sidecar persist memory to SQLite?

```
Current: In-memory, lost on restart
├─ Operator history gone
├─ Brain learning not accumulated
└─ Fine for dev, breaks in production

Proposed: Add SQLite with optional Postgres upgrade path
├─ Session persistence: yes
├─ Audit trail: yes
├─ Durability: yes
└─ Effort: 1-2 hours (SQLite), upgrade path clear

This is SIGNIFICANT. Do you want this in scope? (Yes / Defer)
```

**My recommendation**: **Defer to next session** — Not blocking anything now. List as Session 11 work.

---

### Decision 6️⃣ — Snapshot + Replay Delta Plan

**Question**: Document scaling optimization for replay?

```
Current: Full replay endpoint (inefficient at scale)

Proposed: Add to roadmap
├─ Plan: Snapshot-based delta replay
├─ Result: 100ms load (vs 5s now)
├─ Implementation: Future, but document now
└─ Effort: 10 minutes to write spec

Do you want this captured? (Yes / Defer)
```

**My recommendation**: **Yes, document now** — Future-proofs architecture.

---

## 🟢 Summary: What I Can Do Today

If you answer the decisions above, here's what gets applied:

| Decision           | If Yes               | If No            | Effort |
| ------------------ | -------------------- | ---------------- | ------ |
| 1️⃣ Memory events   | Add bus publish code | Update audit doc | 20 LOC |
| 2️⃣ iframe security | Apply full patch     | Skip (risky)     | 30 min |
| 3️⃣ WS doc          | Add comment header   | Skip             | 5 min  |
| 4️⃣ Verify IDE WS   | Verify + patch       | Skip (risky)     | 15 min |
| 5️⃣ Persistence     | Defer to S11         | Defer            | —      |
| 6️⃣ Snapshot plan   | Add to roadmap       | Defer            | 10 min |

---

## 📋 My Recommended Path (Blocking Risks First)

**Do today (Session 10)**:

1. ✅ **iframe security patch** (2️⃣) — closes 🔴 CRITICAL hole
2. ✅ **Verify IDE WsClient** (4️⃣) — detects bypassed security
3. ✅ **WS documentation** (3️⃣) — prevents future accidents
4. ✅ **Memory model decision** (1️⃣) — informs next work
5. ✅ **Snapshot plan** (6️⃣) — unblocks future scaling

**Defer (Session 11)**:

- ⏳ **Persistence layer** (5️⃣) — nice-to-have, not blocking

---

## Next Move

**Please answer**:

```
Decision 1 (Memory): [A] or [B] or [Ask me more]
Decision 2 (iframe): [Yes] or [No] or [Review first]
Decision 3 (WS doc): [Yes] or [No]
Decision 4 (Verify IDE): [Yes] or [Defer]
Decision 5 (Persistence): [Yes] or [Defer]
Decision 6 (Snapshot plan): [Yes] or [Defer]
```

I'll execute immediately. ⚡
