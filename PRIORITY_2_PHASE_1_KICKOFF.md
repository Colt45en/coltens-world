# Priority 2, Phase 1: Approval Expiry — Kickoff

**Status**: 🚀 READY TO START
**Timeline**: 3-4 hours
**Date**: 2026-02-25

---

## 🎯 What You're Doing Today

Add **approval TTL (Time To Live)** so approvals automatically expire after 10 minutes if user doesn't decide.

**Why**: Prevents approvals hanging forever, improves UX.

**Result**:
- Approvals auto-reject after 600,000ms (10 min)
- GET `/approvals/:id` returns **410 Gone** if expired
- Background cleanup task runs periodically

---

## 📋 Checklist (Track as You Go)

```
Phase 1: Approval Expiry (3-4 hours)
├─ [ ] Understand current schema (15 min read)
├─ [ ] Add TTL columns to schema (30 min code)
├─ [ ] Implement isApprovalExpired() method (20 min code)
├─ [ ] Implement cleanupExpiredApprovals() method (20 min code)
├─ [ ] Update GET /approvals/:id route (15 min code)
├─ [ ] Update POST /approvals/:id/decide route (15 min code)
├─ [ ] Update state-machine.ts (20 min code)
├─ [ ] Build & verify no errors (10 min)
├─ [ ] Write unit test for expiry (30 min)
├─ [ ] Manual smoke test (15 min)
└─ [ ] DONE ✅ → Move to Phase 2
```

---

## 🏗 Files You'll Modify Today

```
apps/nucleus/src/
├── ledger/
│   └── ledger.ts           ← Main changes (3 methods + schema)
├── routes/
│   └── ledger.ts           ← Update 2 endpoints
└── approvals/
    └── state-machine.ts    ← Track created_at + TTL
```

---

## 📖 Step-by-Step Implementation

### Step 1: Understand Current Schema (Read Only)

**File**: `apps/nucleus/src/ledger/ledger.ts`

Find the approvals table schema: Look for `approvals:` and read current structure.

**Expected to see**:
```typescript
approvals: {
  approval_id: string;
  decision?: 'approved' | 'rejected';
  decided_at?: number;
  // (No created_at or TTL yet)
}
```

**Action**: Just read, understand the current shape.

---

### Step 2: Add TTL Fields to Schema

**File**: `apps/nucleus/src/ledger/ledger.ts`

**Find**: The approvals table initialization in constructor or schema definition.

**Add these 3 fields**:
```typescript
approvals: {
  approval_id: string;
  decision?: 'approved' | 'rejected' | 'expired';  // ADD 'expired'
  decided_at?: number;
  created_at: number;           // ✨ ADD - timestamp when requested
  ttl_ms: number;               // ✨ ADD - expires in 600000ms (10 min)
  status: 'pending' | 'decided'; // ✨ ADD - track expiry separately
}
```

---

### Step 3: Add Methods to Ledger Class

**File**: `apps/nucleus/src/ledger/ledger.ts`

Add these **3 methods** to the `Ledger` class:

**Method 1: Check if expired**
```typescript
isApprovalExpired(approval: Approval, now: number = Date.now()): boolean {
  if (approval.status !== 'pending') return false;
  return (now - approval.created_at) > approval.ttl_ms;
}
```

**Method 2: Get approval with expiry check**
```typescript
getApprovalWithExpiry(approvalId: string, now?: number): Approval | null {
  const approval = this.getApproval(approvalId);
  if (!approval) return null;

  if (this.isApprovalExpired(approval, now)) {
    // Mark as expired in ledger
    this.appendEvent({
      type: 'approval.expired',
      approval_id: approvalId,
      expired_at: Date.now(),
    });
    return {
      ...approval,
      status: 'decided',
      decision: 'expired',
      decided_at: Date.now(),
    };
  }

  return approval;
}
```

**Method 3: Auto-cleanup task**
```typescript
async cleanupExpiredApprovals(): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  // SQLite: Find and mark expired
  try {
    const result = this.db.prepare(`
      UPDATE approvals
      SET status = 'decided', decision = 'expired', decided_at = ?
      WHERE status = 'pending'
        AND (? - created_at) > ttl_ms
    `).run(now, now);

    cleaned = result.changes || 0;

    if (cleaned > 0) {
      console.log(`[Ledger] Auto-cleaned ${cleaned} expired approvals`);
    }
  } catch (error) {
    console.error('[Ledger] Cleanup failed:', error);
  }

  return cleaned;
}
```

---

### Step 4: Update Routes (GET /approvals/:id)

**File**: `apps/nucleus/src/routes/ledger.ts`

**Find**: The `GET /approvals/:id` endpoint

**Replace** the response logic with:
```typescript
// GET /approvals/:id
app.get('/approvals/:id', (req, res) => {
  const approval = ledger.getApprovalWithExpiry(req.params.id);

  // Not found
  if (!approval) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Approval ${req.params.id} not found`
    });
  }

  // Expired (410 Gone - crucial!)
  if (approval.decision === 'expired') {
    return res.status(410).json({
      error: 'EXPIRED',
      message: 'Approval has expired',
      expired_at: approval.decided_at,
      ttl_ms: approval.ttl_ms,
    });
  }

  // Pending or decided
  res.status(200).json({
    approval,
    status: approval.status,
    decision: approval.decision,
  });
});
```

**Key Detail**: Return **410** (not 404) for expired. This tells the client "it existed but is gone" vs "never existed".

---

### Step 5: Update Routes (POST /approvals/:id/decide)

**File**: `apps/nucleus/src/routes/ledger.ts`

**Find**: The `POST /approvals/:id/decide` endpoint

**Replace** the decision logic with:
```typescript
// POST /approvals/:id/decide
app.post('/approvals/:id/decide', (req, res) => {
  const { id: approval_id } = req.params;
  const { decision } = req.body as { decision: 'approved' | 'rejected' };

  // Validate input
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({
      error: 'BAD_ARGS',
      message: 'decision must be "approved" or "rejected"',
    });
  }

  // Get approval (checks expiry)
  const approval = ledger.getApprovalWithExpiry(approval_id);

  // Not found
  if (!approval) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Approval ${approval_id} not found`,
    });
  }

  // Already decided or expired
  if (approval.decision) {
    return res.status(409).json({  // 409 Conflict (not 400!)
      error: 'CONFLICT',
      code: approval.decision === 'expired' ? 'EXPIRED' : 'ALREADY_DECIDED',
      message: `Approval already ${approval.decision}`,
      existing_decision: approval.decision,
      decided_at: approval.decided_at,
    });
  }

  // Record decision
  try {
    ledger.appendEvent({
      type: 'approval.decided',
      approval_id,
      decision,
      decided_at: Date.now(),
    });

    // Update state machine
    stateMachine.onApprovalDecision({ approval_id, decision });

    return res.status(200).json({
      approval_id,
      decision,
      decided_at: Date.now(),
    });
  } catch (error) {
    console.error(`[Ledger] Decision failed:`, error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to record approval decision',
    });
  }
});
```

---

### Step 6: Update State Machine

**File**: `apps/nucleus/src/approvals/state-machine.ts`

**Find**: The `onApprovalRequested()` method

**Update** to track creation time and TTL:
```typescript
onApprovalRequested(event: {
  payload: {
    approval_id: string;
    ttl_ms?: number;  // Optional, defaults to 10 min
  };
}): void {
  const ttl_ms = event.payload.ttl_ms || 600000;  // 10 min default

  this.approvals[event.payload.approval_id] = {
    approval_id: event.payload.approval_id,
    status: 'pending',
    created_at: Date.now(),  // ✨ ADD THIS
    ttl_ms,                   // ✨ ADD THIS
  };

  // Optional: Schedule cleanup if not already scheduled
  if (!this.cleanup_scheduled) {
    this.scheduleCleanup();
  }
}

// Add this helper method
private scheduleCleanup(): void {
  if (this.cleanup_scheduled) return;
  this.cleanup_scheduled = true;

  // Run cleanup every 60 seconds
  setInterval(async () => {
    const expired = await ledger.cleanupExpiredApprovals();
    if (expired > 0) {
      console.log(`[StateM] Cleaned ${expired} expired approvals`);
    }
  }, 60000);
}

private cleanup_scheduled = false;
```

---

## 🧪 Testing: Unit Test

**File**: `apps/nucleus/test/ledger-expiry.test.ts` (NEW FILE)

Create this test file:

```typescript
import { describe, it, expect } from '@jest/globals';
import { Ledger } from '../src/ledger/ledger';

describe('Ledger: Approval Expiry', () => {
  let ledger: Ledger;

  beforeEach(() => {
    ledger = new Ledger(':memory:');  // In-memory SQLite for tests
  });

  it('should mark approval as expired after TTL', () => {
    const now = Date.now();

    // Create approval with 1-second TTL
    ledger.appendEvent({
      type: 'approval.requested',
      approval_id: 'appr-1',
      payload: { ttl_ms: 1000 },
    });

    const approval = ledger.getApproval('appr-1');

    // Before TTL: not expired
    expect(ledger.isApprovalExpired(approval, now + 500)).toBe(false);

    // After TTL: expired
    expect(ledger.isApprovalExpired(approval, now + 1500)).toBe(true);
  });

  it('should return 410 for expired approval', () => {
    const approval = ledger.getApprovalWithExpiry('appr-1');

    if (approval?.decision === 'expired') {
      // Simulate 410 response
      expect(approval.status).toBe('decided');
      expect(approval.decision).toBe('expired');
    }
  });

  it('should cleanup expired approvals', async () => {
    // Create 3 approvals (1 expired, 2 pending)
    // ...setup...

    const cleaned = await ledger.cleanupExpiredApprovals();

    expect(cleaned).toBeGreaterThan(0);
    expect(cleaned).toBeLessThanOrEqual(3);
  });
});
```

---

## 🔨 Build & Verify

```bash
cd "c:\Users\colte\colten projects\coltens world"

# Build nucleus
pnpm --filter './apps/nucleus' run build

# Expected result:
# ✅ No TypeScript errors
# ✅ No lint warnings (unless pre-existing)
```

If you get errors, they're likely:
- **Cannot find module**: Missing import (add it)
- **Type mismatch**: Schema field mismatch (check field names)
- **Missing method**: Forgot to add method (copy from above)

---

## 🧪 Manual Smoke Test

**Terminal 1: Start Nucleus**
```bash
cd "c:\Users\colte\colten projects\coltens world\apps\nucleus"
pnpm dev
# Should show no errors about approval expiry
```

**Terminal 2: Test with curl**

```bash
# 1. Create approval
curl -X POST http://localhost:3000/ledger/append \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-1",
    "type": "approval.requested",
    "v": 1,
    "ts": "'$(date -u +'%Y-%m-%dT%H:%M:%SZ')'",
    "correlation_id": "corr-1",
    "approval_id": "appr-test-1",
    "producer": "test",
    "payload_hash": "hash1",
    "payload": {
      "approval_id": "appr-test-1",
      "ttl_ms": 2000,
      "tool_name": "sensitive_tool"
    }
  }'

# 2. Check immediately (should be pending)
curl http://localhost:3000/approvals/appr-test-1
# Expected: 200 OK, status="pending"

# 3. Wait 3 seconds
sleep 3

# 4. Check again (should be expired)
curl http://localhost:3000/approvals/appr-test-1
# Expected: 410 Gone, decision="expired" ✅
```

---

## ✅ Done Checklist for Phase 1

- [ ] Added `created_at`, `ttl_ms`, `status` to schema
- [ ] Implemented `isApprovalExpired()`
- [ ] Implemented `getApprovalWithExpiry()`
- [ ] Implemented `cleanupExpiredApprovals()`
- [ ] Updated `GET /approvals/:id` (returns 410)
- [ ] Updated `POST /approvals/:id/decide` (returns 409 on conflict)
- [ ] Updated `state-machine.ts` (tracks created_at + TTL)
- [ ] Build passes: `pnpm --filter './apps/nucleus' run build`
- [ ] Unit test written and passing
- [ ] Manual smoke test successful
- [ ] Commit: `git commit -m "feat(ledger): add approval TTL enforcement"`

---

## 🚀 Next: Phase 2

Once Phase 1 is done, move to:
**[PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) → Change 2B: Concurrency Safety**

This will add **409 Conflict** handling for double-decides.

---

## 📞 Stuck?

- **Schema error**: Check table structure in ledger.ts schema section
- **Method not found**: Verify you added all 3 methods to Ledger class
- **Build fails**: Look for "Cannot find name" errors (missing imports or typos)
- **Route not responding**: Verify endpoint path matches exactly

**Last Resort**: Read the full guide:
[PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) → Change 1 section

---

**Status**: 🎯 Ready to code!

**Time**: ~3-4 hours (can be split across 2 days)

**Next**: Update this checklist as you complete each item → When all done, move to Phase 2 ✅
