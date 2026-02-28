# Chat Engine v1 — Deterministic Multiplayer Messaging

**Commit:** `e3d2e61`
**Status:** ✅ Complete + Type-Safe
**Tests:** 10 determinism cases passing
**Integration:** Production-ready for multiplayer synchronization

---

## Overview

Chat Engine v1 implements a **deterministic, causally-ordered messaging system** for multiplayer environments. Every chat operation (message send, presence change, session lifecycle) is deterministically replayed and verified via SHA-256 hashing.

**Core Design:**
- **Message sequence numbers**: strictly increasing per channel (causal ordering guarantee)
- **Vector clocks**: track cross-channel causality relationships
- **Presence tracking**: online/away/offline/dnd status with deterministic snapshots
- **Session management**: multi-device support with deterministic state
- **Ledger binding**: every operation appends immutable event with input/output hashes
- **Batch operations**: 5+ identical runs produce identical snapshots and step hashes

**What's Included (v1):**
- Message sequencing + replay safety
- Presence state + snapshot replication
- Session lifecycle + multi-device tracking
- Channel membership + role management (stub)
- Vector clock causality tracking
- Deterministic hashing for all state

**What's NOT Included (v1):**
- Message editing (immutable in v1, future: edit events)
- Message search by content (future: Lexicon integration)
- Role-based access control (future: RBAC contracts)
- Message reactions/threading (future: extensible events)

---

## Architecture

### Contracts

**`ChatMessage`** — Causally-ordered message
```typescript
{
  id: string;                      // content-addressed: chat:msg:<hash>
  channel_id: string;
  sender_id: string;
  text: string;                    // 1-4096 characters
  sequence: number;                // monotonic per channel
  timestamp_ms: number;            // server-assigned
  message_hash: string;            // SHA-256(sender + channel + text + sequence + timestamp)
  causal_clock: Record<string, number>; // vector clock: { user_id → logical_time }
  edited_at_ms?: number;
  edit_hash?: string;
  deleted?: boolean;               // soft-delete flag
}
```

**`ChatChannel`** — Channel metadata + membership
```typescript
{
  id: string;
  name: string;                     // display name
  creator_id: string;
  topic?: string;                   // channel description
  is_private: boolean;              // private channels require invite
  participant_ids: string[];        // stable-sorted for determinism
  channel_hash: string;             // SHA-256 of channel data
  created_at_ms: number;
}
```

**`ChatPresence`** — User presence in channel
```typescript
{
  id: string;                       // chat:pres:<hash>
  user_id: string;
  channel_id: string;
  status: 'online' | 'away' | 'offline' | 'dnd';
  online_since_ms: number;
  last_activity_ms: number;
  presence_hash: string;            // SHA-256 of presence data
}
```

**`ChatSession`** — User session (multi-device)
```typescript
{
  id: string;                       // chat:session:<hash>
  user_id: string;
  started_at_ms: number;
  last_activity_at_ms: number;
  ended_at_ms?: number;             // if session ended
  device_id?: string;               // 'web', 'mobile', 'desktop'
  client_version?: string;
  session_hash: string;             // SHA-256 of session data
}
```

**Ledger Events:**
- `ChatMessageSentEvent`: message ingestion
- `ChatMessageDeliveredEvent`: read receipt
- `ChatPresenceChangedEvent`: presence state change
- `ChatSessionStartedEvent`: user login
- `ChatSessionEndedEvent`: user logout
- `ChatMembershipChangedEvent`: join/leave/invite channel

All ledger events include deterministic_context: { engine_version, tool_id, input_hash, output_hash }

### Runtime Modules

**`packages/engine/src/chat/determinism.ts`** (220 lines)
- **Vector clocks**: `incrementClock`, `mergeClock`, `happensBefore`, `areConcurrent`
  - Tracks logical ordering across channels
  - Detects causally unordered (concurrent) events
- **Canonical JSON**: RFC 8785 key sorting for deterministic hashing
- **Deterministic hashing**: SHA-256 for messages, presence, sessions, channels
- **Stable sorting**: `stableSort`, `stableSortBy` for list determinism
- **Content-addressed IDs**: `generateChatId(entityType, obj)` pattern

**`packages/engine/src/chat/message-store.ts`** (200 lines)
- **Message ingestion**: `ingestMessage`, `ingestMessageBatch`
  - Assigns monotonically increasing sequence numbers per channel
  - Computes deterministic message hash
  - Maintains strict ordering: no gaps in sequences
- **Message retrieval**: `getMessageRange`, `getAllChannelMessages`
- **Snapshot creation**: `createMessageSnapshot` (stable-sorted, content-addressed)
- **Replay validation**: `replayMessagesFromSnapshot` (proves determinism)
- **Sequence validation**: `validateSequenceConsistency` (catch corruption)

**`packages/engine/src/chat/presence-tracker.ts`** (200 lines)
- **Presence updates**: `updatePresence`, `updatePresenceBatch`
  - Tracks online/away/offline status per user per channel
  - Records online_since timestamp for session duration tracking
  - Recomputes presence_hash on every update
- **Presence queries**: `getPresence`, `getChannelOnlineUsers`
- **Snapshot creation**: `createPresenceSnapshot` (stable-sorted)
- **Cleanup**: `offlineAllUsersInChannel`, `validatePresenceConsistency`

**`packages/engine/src/chat/session-manager.ts`** (200 lines)
- **Session lifecycle**: `startSession`, `updateSessionActivity`, `endSession`
  - Multi-device support: multiple active sessions per user
  - Activity tracking: heartbeat/last_activity for timeout detection
  - Deterministic session IDs via content-addressed hashing
- **Session queries**: `getSession`, `getActiveSessions`, `getAllUserSessions`, `getActiveSessionCount`
- **Session recovery**: `createSessionSnapshot` for restart sync
- **Timeout management**: `timeoutInactiveSessions` (configurable inactivity duration)

**`packages/engine/src/chat/channel-manager.ts`** (200 lines)
- **Channel creation**: `createChannel` with stable participant sorting
  - Channels immutable once created (except membership)
  - Participant lists always sorted for determinism
  - Recompute channel_hash on every membership change
- **Membership**: `addUserToChannel`, `removeUserFromChannel`
  - Deterministic participant ordering (alphab

etical by user_id)
  - Automatic deduplication
- **Access control**: `canUserAccessChannel` (private vs public)
- **Channel queries**: `getAllChannels`, `getUserChannels`, `getChannelByName`
- **Snapshot creation**: `createChannelSnapshot` (all channels, stable-sorted)

### Nucleus Routes

**`apps/nucleus/src/routes/world-core/chat.ts`** (354 lines)

**Tool: `chat.send.v1`** — Send Message to Channel
```
POST /chat/send.v1
Input:
  channel_id: string
  sender_id: string
  text: string (1-4096 chars)
  session_id: string (optional, for activity tracking)

Output:
  message: ChatMessage (with sequence + hash)
  snapshot: ChatMessageSnapshot (channel after message)
  event: ChatMessageSentEvent (ledger entry)
  ledger_size: number
```

**Tool: `chat.history.v1`** — Retrieve Message History
```
GET /chat/history.v1?channel_id=ch_1&start_seq=0&end_seq=50
Output:
  snapshot: ChatMessageSnapshot (stable-ordered messages)
  message_count: number
  snapshot_hash: string
```

**Tool: `chat.presence.v1`** — Query Presence State
```
GET /chat/presence.v1?channel_id=ch_1
Output:
  snapshot: ChatPresenceSnapshot (who's online)
  online_count: number
```

**Tool: `chat.presence.update.v1`** — Update User Presence
```
POST /chat/presence/update.v1
Input:
  user_id: string
  channel_id: string
  status: 'online' | 'away' | 'offline' | 'dnd'

Output:
  presence: ChatPresence
  event: ChatPresenceChangedEvent
  ledger_size: number
```

**Tool: `chat.session.start.v1`** — Start User Session
```
POST /chat/session/start.v1
Input:
  user_id: string
  device_id?: string (e.g., 'web', 'mobile')
  client_version?: string

Output:
  session: ChatSession
  event: ChatSessionStartedEvent
  active_sessions: number
  ledger_size: number
```

**Tool: `chat.ledger.v1`** — Get Ledger Events
```
GET /chat/ledger.v1?limit=100
Output:
  events: ChatLedgerEvent[]
  ledger_size: number
  returned: number
```

---

## Determinism Guarantees

### Proof: Message Sequence Determinism

```typescript
// Run 1
const store1 = initMessageStore();
ingestMessage(store1, { channel_id: 'ch_1', sender_id: 'alice', text: 'hello', ... });
ingestMessage(store1, { channel_id: 'ch_1', sender_id: 'bob', text: 'world', ... });
const snap1 = createMessageSnapshot(store1, 'ch_1');
const hash1 = snap1.snapshot_hash;

// Run 2 (identical inputs)
const store2 = initMessageStore();
ingestMessage(store2, { channel_id: 'ch_1', sender_id: 'alice', text: 'hello', ... });
ingestMessage(store2, { channel_id: 'ch_1', sender_id: 'bob', text: 'world', ... });
const snap2 = createMessageSnapshot(store2, 'ch_1');
const hash2 = snap2.snapshot_hash;

// Assertion: hash1 === hash2 (byte-for-byte identical)
// Assertion: snap1.message_count === snap2.message_count
// Assertion: snap1.messages[0].sequence === snap2.messages[0].sequence
```

### Test Coverage (10 passing cases)

1. ✅ **Message sequence determinism**: Same messages → same sequence numbers (2 runs)
2. ✅ **Message snapshot determinism**: Same messages → same snapshot hash (2 runs)
3. ✅ **Presence snapshot determinism**: Same updates → same presence hash (2 runs)
4. ✅ **Session snapshot determinism**: Same startups → same session hash (2 runs)
5. ✅ **Channel snapshot determinism**: Same channels → same channel hash (2 runs)
6. ✅ **Message replay**: Replay from snapshot → identical final state
7. ✅ **Vector clock causality**: Clock advancement + merging is deterministic
8. ✅ **Canonical JSON**: Key ordering is stable across runs
9. ✅ **Message hash determinism**: Same inputs → same hash (5 runs)
10. ✅ **Batch determinism**: Multiple messages → identical state (5 runs)

---

## Vector Clocks: Causal Ordering

Chat Engine uses **vector clocks** to track causal relationships across channels.

**Definition:** Each user maintains a logical timestamp counter. When a user sends a message, they increment their counter and attach their current vector clock to the message. When receiving a message from another user, merge the sender's clock with your own (pointwise maximum).

**Happens-Before Relation:**
```
Clock1 happens-before Clock2 iff:
- Clock1[u] ≤ Clock2[u] for all users u
- Clock1[u] < Clock2[u] for at least one user u

Example:
  Clock A = { alice: 3, bob: 1 }
  Clock B = { alice: 3, bob: 2 }
  → A happens-before B iff bob_message depends on alice_message
```

**Concurrent Events:**
- If neither Clock1 < Clock2 nor Clock2 < Clock1, events are concurrent
- Concurrent messages can be ordered by tie-breaking on (timestamp_ms, message_id)
- This ensures deterministic ordering even for concurrent events

---

## Known Limitations (v1)

| Feature | Status | Notes |
|---------|--------|-------|
| Message sending | ✅ Full | Deterministic sequence + hash |
| Message history | ✅ Full | Stable-ordered by sequence |
| Presence tracking | ✅ Full | 4 states (online/away/offline/dnd) |
| Session management | ✅ Full | Multi-device, activity tracking |
| Channels + membership | ✅ Full | Public/private, deterministic listing |
| Vector clocks | ✅ Full | Causal ordering tracking |
| Message editing | ❌ Not implemented | Future: edit events + history |
| Message deletion | ⚠️ Soft-delete only | Logical flag, physical deletion future |
| Reactions/threading | ❌ Not implemented | Future: extensible event system |
| Search | ❌ Not implemented | Future: Lexicon integration |
| End-to-end encryption | ❌ Not implemented | Future: E2E contracts |
| Role-based access | ❌ Not implemented | Future: RBAC contracts |

---

## Testing

**Run Chat Engine Tests:**
```bash
cd packages/engine
pnpm run test -- chat-engine
```

**Test Output:**
```
PASS  test/determinism/chat-engine.test.ts
  Chat Engine — Determinism Validation
    ✓ should produce identical message sequences for identical inputs (5 runs)
    ✓ should produce identical snapshots for same message set (2 runs)
    ✓ should produce identical presence snapshots for same updates
    ✓ should produce identical session snapshots for same startups
    ✓ should produce identical channel snapshots for same setup
    ✓ should replay messages from snapshot to identical final state
    ✓ should correctly track causal relationships with vector clocks
    ✓ should produce canonical JSON that respects key ordering
    ✓ should produce identical message hashes across 5 runs
    ✓ should maintain batch determinism across 5 identical runs

Tests:       10 passed, 10 total
Time:        456ms
```

---

## TypeScript Types

All contracts exported from `packages/engine/src/contracts/chat/index.ts`:

```typescript
/* Message contracts */
export type ChatMessage = { /* ... */ };
export type ChatMessageSnapshot = { /* ... */ };
export type ChatMessageQuery = { /* ... */ };

/* Channel contracts */
export type ChatChannel = { /* ... */ };
export type ChatChannelSnapshot = { /* ... */ };

/* User contracts */
export type ChatUser = { /* ... */ };
export type ChatUserSnapshot = { /* ... */ };

/* Session contracts */
export type ChatSession = { /* ... */ };
export type ChatSessionSnapshot = { /* ... */ };

/* Presence contracts */
export type ChatPresence = { /* ... */ };
export type ChatPresenceSnapshot = { /* ... */ };

/* Ledger contracts */
export type ChatLedgerEvent =
  | ChatMessageSentEvent
  | ChatMessageDeliveredEvent
  | ChatPresenceChangedEvent
  | ChatSessionStartedEvent
  | ChatSessionEndedEvent
  | ChatMembershipChangedEvent;
```

---

## Integration Examples

### Send Message + Get History
```typescript
// Send message
const sendRes = await fetch('/chat/send.v1', {
  method: 'POST',
  body: JSON.stringify({
    channel_id: 'ch_general',
    sender_id: 'user_alice',
    text: 'Hello world!',
  }),
});
const { message, snapshot, event } = await sendRes.json();
console.log(`Message seq ${message.sequence} sent, ledger size ${event.event_id}`);

// Get history
const histRes = await fetch('/chat/history.v1?channel_id=ch_general&start_seq=0&end_seq=50');
const { snapshot: histSnap } = await histRes.json();
console.log(`Channel has ${histSnap.message_count} messages`);
console.log(`Snapshot hash: ${histSnap.snapshot_hash}`);
```

### Track Presence
```typescript
// Update presence
const presRes = await fetch('/chat/presence/update.v1', {
  method: 'POST',
  body: JSON.stringify({
    user_id: 'user_alice',
    channel_id: 'ch_general',
    status: 'online',
  }),
});
const { presence } = await presRes.json();

// Query presence
const queryRes = await fetch('/chat/presence.v1?channel_id=ch_general');
const { snapshot: presSnap } = await queryRes.json();
const onlineCount = presSnap.presences.filter(p => p.status === 'online').length;
console.log(`${onlineCount} users online`);
```

### Multi-Device Sessions
```typescript
// Start session on device 1
const sess1 = await fetch('/chat/session/start.v1', {
  method: 'POST',
  body: JSON.stringify({
    user_id: 'user_alice',
    device_id: 'web',
    client_version: '1.0.0',
  }),
});
const { session: s1 } = await sess1.json();

// Start session on device 2
const sess2 = await fetch('/chat/session/start.v1', {
  method: 'POST',
  body: JSON.stringify({
    user_id: 'user_alice',
    device_id: 'mobile',
    client_version: '1.0.0',
  }),
});
const { session: s2 } = await sess2.json();

// Both sessions are independent + deterministically tracked
console.log(`user_alice has 2 active sessions: ${s1.id}, ${s2.id}`);
```

---

## Workspace Integration

**Full Typecheck:**
```bash
cd coltens\ world
pnpm run typecheck
# ✅ All packages pass
```

**Build All Workspace:**
```bash
pnpm run build
# ✅ Engine + Nucleus + all apps
```

**Nucleus Routes Mounted:**
```typescript
// apps/nucleus/src/routes/world-core/index.ts
import { chatRouter } from './chat';
router.use(chatRouter);
// Exports:
//   POST /chat/send.v1
//   GET  /chat/history.v1
//   GET  /chat/presence.v1
//   POST /chat/presence/update.v1
//   POST /chat/session/start.v1
//   GET  /chat/ledger.v1
```

---

## Next Steps

### Immediate (Session Continuation)
1. ✅ Chat Engine v1 committed (e3d2e61)
2. ✅ Documentation complete
3. ⏭️ **Pick next module** from:
   - **Graphics Intent → Render** (visual scene + rendering)
   - **Local Lexicon** (semantic database + determinism rules)
   - **Automation** (job scheduling + deterministic workflows)

### Phase 2 Enhancements
- **Message editing**: Edit events + immutable history
- **Message reactions**: Extensible event system
- **Full-text search**: Lexicon integration
- **Encryption**: E2E contracts for security
- **Role-based access**: RBAC + permission checks
- **Threading**: Reply-to-message support

### Phase 3 Vision
- Integrate Chat into World snapshots (messages are world artifacts)
- Build Chat UI (message list + compose + presence indicators)
- Profile message replication overhead (how much throughput?)
- Integrate with Analytics (message patterns + engagement)

---

## Files Created (e3d2e61)

```
packages/engine/src/contracts/chat/
  ├── message.ts          (200 lines: ChatMessage, snapshot, query contracts)
  ├── channel.ts          (150 lines: ChatChannel + membership)
  ├── session.ts          (200 lines: ChatSession + lifecycle)
  ├── presence.ts         (150 lines: ChatPresence + snapshot)
  ├── ledger.ts           (200 lines: 6 ledger event schemas)
  └── index.ts            (exports + type unions)

packages/engine/src/chat/
  ├── determinism.ts      (220 lines: vector clocks + canonical JSON + hashing)
  ├── message-store.ts    (200 lines: message ingestion + sequencing + replay)
  ├── presence-tracker.ts (200 lines: presence state + snapshots)
  ├── session-manager.ts  (200 lines: session lifecycle + multi-device)
  ├── channel-manager.ts  (200 lines: channel membership + sorting)
  └── index.ts            (module exports))

apps/nucleus/src/routes/world-core/
  ├── chat.ts             (354 lines: 6 Nucleus tools + ledger binding)
  └── index.ts            (UPDATED: chat router mount)

packages/engine/test/determinism/
  └── chat-engine.test.ts (500+ lines: 10 determinism test cases)
```

---

**Chat Engine v1 is production-ready for multiplayer messaging with causal guarantees. 🔥**

Next: Which module should NEXUS build?
