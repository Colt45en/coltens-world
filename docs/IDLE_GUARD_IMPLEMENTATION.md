✅ **IDLE AUTONOMY GUARD — COMMAND/EFFECT SPLIT IMPLEMENTED**

---

## What's Running Now

### 1️⃣ **Nucleus** (Node) — Command Emitter

**File:** `apps/nucleus/src/bus-ws-bridge.ts` (lines 162-216)

**What it does:**

- Accepts POST requests at 3 endpoints
- Emits **idle.command.v1** to `notes/events.jsonl`
- Broadcasts live to WS clients

**Endpoints:**

```bash
# Prompt the idle mode
curl -s -X POST http://localhost:8787/idle/prompt \
  -H "content-type: application/json" \
  -d '{"mode":"dream_idle","text":"run drift synth for 30m"}'

# Approve with TTL
curl -s -X POST http://localhost:8787/idle/approve \
  -H "content-type: application/json" \
  -d '{"mode":"dream_idle","phrase":"approve dream idle","ttlSeconds":3600}'

# Revoke immediately
curl -s -X POST http://localhost:8787/idle/revoke \
  -H "content-type: application/json" \
  -d '{"mode":"dream_idle","reason":"stop now"}'
```

---

### 2️⃣ **Python Sidecar** — Command Consumer + Effect Emitter

**File:** `apps/py-sidecar/overseer_nexus_ai_core.py` (lines 155-428)

**Classes:**

- **`IdleCommandReader`** — streams `notes/events.jsonl` using byte offset cursor
- **`IdleGuardState`** — dataclass for persistent state
- **`IdleAutonomyGuard`** — applies commands, gates activation

**What it does:**

1. Reads new idle.command.v1 from the unified stream
2. Applies state changes (prompted/approved/revoked)
3. Emits **idle.effect.v1** for each state transition
4. Guards `can_activate()` check
5. Persists state to `notes/idle_state.json`

---

### 3️⃣ **Unified Event Stream**

**File:** `notes/events.jsonl`

**Contains interleaved:**

```
idle.command.v1 (from Nucleus)
  └─ {mode, action: prompt|approve|revoke, args}

idle.effect.v1 (from Python)
  └─ {mode, status: prompted|approved|revoked|blocked|activated, ...state}
```

**Cursor Tracking**
`notes/idle_cursor.json` stores `{"byteOffset": N}` so Python doesn't reprocess commands.

---

## How to Run It

### Start Python Runtime

```bash
cd apps/py-sidecar
python overseer_nexus_ai_core.py --run-idle --idle-mode dream_idle
```

**Expected output:**

```
[idle] starting runtime for mode=dream_idle
[idle] commands: notes/events.jsonl
[idle] cursor: notes/idle_cursor.json
[idle] state: notes/idle_state.json
```

This loop will:

- Poll for new commands every tick
- Check if can activate (prompted && approved && not expired)
- Mark activated and sleep 1s
- Or block and sleep 0.5s

---

## Example Workflow

**Terminal 1: Start Python runtime**

```bash
python overseer_nexus_ai_core.py --run-idle
```

**Terminal 2: Send commands**

```bash
# 1) Prompt
curl -s -X POST http://localhost:8787/idle/prompt \
  -H "content-type: application/json" \
  -d '{"mode":"dream_idle","text":"run idle task"}'

# 2) Approve
curl -s -X POST http://localhost:8787/idle/approve \
  -H "content-type: application/json" \
  -d '{"mode":"dream_idle","phrase":"approve","ttlSeconds":3600}'

# 3) Watch state updates
tail -f notes/events.jsonl | grep idle
tail -f notes/events.md | grep idle
```

**What you'll see in `notes/events.jsonl`:**

```json
{"schema":{"name":"bus.envelope","version":"1.0.0"},"id":"...","type":"idle.command.v1","ts":"...","source":{"system":"nucleus","module":"idle_command_router"},"payload":{"mode":"dream_idle","action":"prompt","args":{"text":"run idle task"}}}

{"schema":{"name":"bus.envelope","version":"1.0.0"},"id":"...","type":"idle.effect.v1","ts":"...","source":{"system":"py-sidecar","module":"idle_guard"},"payload":{"mode":"dream_idle","status":"prompted","prompt_text":"run idle task","state":{"prompted":true,"approved":false,"approvalExpiresTs":0}}}

{"schema":{"name":"bus.envelope","version":"1.0.0"},"id":"...","type":"idle.effect.v1","ts":"...","source":{"system":"py-sidecar","module":"idle_guard"},"payload":{"mode":"dream_idle","status":"approved","approval_phrase":"approve","ttlSeconds":3600,"approval_token":"...","state":{"prompted":true,"approved":true,"approvalExpiresTs":...}}}

{"schema":{"name":"bus.envelope","version":"1.0.0"},"id":"...","type":"idle.effect.v1","ts":"...","source":{"system":"py-sidecar","module":"idle_guard"},"payload":{"mode":"dream_idle","status":"activated","approval_token":"...","prompt_text":"run idle task","state":{"prompted":true,"approved":true,"approvalExpiresTs":...}}}
```

---

## State Files

### `notes/idle_state.json`

```json
{
  "mode": "dream_idle",
  "prompted": true,
  "prompt_text": "run idle task",
  "approved": true,
  "approval_token": "5a3c2e...",
  "approval_expires_ts": 1739000000.0,
  "last_activation_ts": 1739000005.0,
  "last_block_reason": "ok"
}
```

### `notes/idle_cursor.json`

```json
{
  "byteOffset": 4521
}
```

---

## Design Highlights

✅ **Deterministic** — Tokens use sha256(canonical_json) of {mode, phrase, prompt_text, timestamp}
✅ **Resumable** — Cursor ensures no lost/duplicate command processing
✅ **Observable** — All state changes are logged as effects
✅ **Multi-mode** — Same code handles multiple autonomous modes concurrently
✅ **Controlled** — Always requires explicit prompt + approval, with TTL

---

## Next Steps

Want to:

- ✅ Add **rate-limiting** for activated effects? (emit only transitions)
- ✅ Connect IDE panel to poll state?
- ✅ Add UI for prompt/approve/revoke?
- ✅ Test with real idle workload?

Just say the word! 🚀
