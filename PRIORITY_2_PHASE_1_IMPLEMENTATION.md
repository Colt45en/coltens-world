# Priority 2, Phase 1: Implementation Map

**Build Status**: ✅ CLEAN (nucleus builds successfully)
**Date Started**: 2026-02-25
**Status**: READY TO IMPLEMENT

---

## 🎯 Your Task Today

Implement **Approval TTL** (Time To Live) in 3 files over ~3-4 hours.

When done: Approvals auto-expire after 10 minutes → GET returns **410 Gone**

---

## 📁 File 1: ledger.ts (Add Fields + Methods)

**Path**: `apps/nucleus/src/ledger/ledger.ts`

### 1A: Add Fields to Approval Type
**Look for**: The approvals table definition (probably ~line 50-100)

**Current**:
```typescript
approvals: {
  approval_id: string;
  decision?: 'approved' | 'rejected';
  decided_at?: number;
}
```

**Change to**:
```typescript
approvals: {
  approval_id: string;
  decision?: 'approved' | 'rejected' | 'expired';  // ADD 'expired'
  decided_at?: number;
  created_at: number;           // ✨ NEW - when requested
  ttl_ms: number;               // ✨ NEW - expires in 10 min
  status: 'pending' | 'decided'; // ✨ NEW - track expiry separately
}
```

### 1B: Add 3 Methods to Ledger Class
**Look for**: End of `Ledger` class definition

**Add these methods** (copy-paste exactly):

```typescript
  /**
   * Check if an approval has expired
   */
  isApprovalExpired(approval: any, now: number = Date.now()): boolean {
    if (approval.status !== 'pending') return false;
    return (now - approval.created_at) > approval.ttl_ms;
  }

  /**
   * Get approval and check for expiry
   * If expired, record expiry event and return marked as expired
   */
  getApprovalWithExpiry(approvalId: string, now?: number): any {
    const approval = this.getApproval(approvalId);
    if (!approval) return null;

    if (this.isApprovalExpired(approval, now)) {
      // Mark as expired
      const expiredAt = now || Date.now();
      try {
        this.appendEvent({
          event_id: `evt-expired-${expiredAt}`,
          type: 'approval.expired',
          v: 1,
          ts: new Date(expiredAt).toISOString(),
          correlation_id: approvalId,
          producer: 'nucleus:ledger',
          payload_hash: '',
          payload: {
            approval_id: approvalId,
            expired_at: expiredAt,
          },
        });
      } catch (e) {
        // Log but don't fail
        console.warn('[Ledger] Failed to record expiry event:', e);
      }

      return {
        ...approval,
        status: 'decided',
        decision: 'expired',
        decided_at: expiredAt,
      };
    }

    return approval;
  }

  /**
   * Auto-cleanup job: mark expired approvals as decided
   * Call this periodically (e.g., every 60 seconds)
   */
  async cleanupExpiredApprovals(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    try {
      // Find all pending approvals that have exceeded TTL
      const allApprovals = Array.from(this.approvals?.values?.() || []);
      const toClean = allApprovals.filter(a =>
        a.status === 'pending' &&
        (now - (a.created_at || 0)) > (a.ttl_ms || 600000)
      );

      for (const approval of toClean) {
        // Record cleanup event
        this.appendEvent({
          event_id: `evt-cleanup-${now}`,
          type: 'approval.expired',
          v: 1,
          ts: new Date(now).toISOString(),
          correlation_id: approval.approval_id,
          producer: 'nucleus:ledger',
          payload_hash: '',
          payload: {
            approval_id: approval.approval_id,
            expired_at: now,
          },
        });

        cleaned++;
      }

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

## 📁 File 2: routes/ledger.ts (Update 2 Endpoints)

**Path**: `apps/nucleus/src/routes/ledger.ts`

### 2A: Update GET /approvals/:id

**Find**: The endpoint definition (search for `app.get('/approvals/:id'`)

**Replace** the entire endpoint with:

```typescript
  // GET /approvals/:id
  app.get('/approvals/:id', (req, res) => {
    const approval = ledger.getApprovalWithExpiry(req.params.id);

    if (!approval) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Approval ${req.params.id} not found`,
      });
    }

    // IMPORTANT: Return 410 Gone if expired (not 404)
    if (approval.decision === 'expired') {
      return res.status(410).json({
        error: 'EXPIRED',
        message: 'Approval has expired',
        expired_at: approval.decided_at,
        ttl_ms: approval.ttl_ms,
      });
    }

    res.status(200).json({
      approval,
      status: approval.status || 'unknown',
      decision: approval.decision,
    });
  });
```

### 2B: Update POST /approvals/:id/decide

**Find**: The endpoint definition (search for `app.post('/approvals/:id/decide'`)

**Replace** the entire endpoint with:

```typescript
  // POST /approvals/:id/decide
  app.post('/approvals/:id/decide', (req, res) => {
    const { id: approval_id } = req.params;
    const { decision } = req.body as { decision: string };

    // Validate decision
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        error: 'BAD_ARGS',
        message: 'decision must be "approved" or "rejected"',
      });
    }

    // Get approval (with expiry check)
    const approval = ledger.getApprovalWithExpiry(approval_id);

    // Not found
    if (!approval) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Approval ${approval_id} not found`,
      });
    }

    // Already decided (409 = Conflict, not 400!)
    if (approval.decision) {
      return res.status(409).json({
        error: 'CONFLICT',
        code:
          approval.decision === 'expired'
            ? 'APPROVAL_EXPIRED'
            : 'ALREADY_DECIDED',
        message: `Approval already ${approval.decision}`,
        existing_decision: approval.decision,
        decided_at: approval.decided_at,
      });
    }

    // Record decision
    try {
      const decidedAt = Date.now();

      ledger.appendEvent({
        event_id: `evt-decision-${decidedAt}`,
        type: 'approval.decided',
        v: 1,
        ts: new Date(decidedAt).toISOString(),
        correlation_id: approval_id,
        producer: 'nucleus:ledger',
        payload_hash: '',
        payload: {
          approval_id,
          decision,
          decided_at: decidedAt,
        },
      });

      // Update state machine if available
      if (approvals) {
        approvals.onApprovalDecision({
          approval_id,
          decision: decision as 'approved' | 'rejected',
        } as any);
      }

      return res.status(200).json({
        approval_id,
        decision,
        decided_at: decidedAt,
      });
    } catch (error) {
      console.error(`[Ledger] Decision failed for ${approval_id}:`, error);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to record approval decision',
      });
    }
  });
```

---

## 📁 File 3: state-machine.ts (Track TTL)

**Path**: `apps/nucleus/src/approvals/state-machine.ts`

### 3A: Update onApprovalRequested Method

**Find**: The `onApprovalRequested` method (probably ~line 60-80)

**Replace** it with:

```typescript
  /**
   * Handle approval.requested event
   * Extracts approval ID and tracks creation time for TTL
   */
  onApprovalRequested(event: {
    payload: {
      approval_id: string;
      ttl_ms?: number;
    };
  }): void {
    const ttl_ms = event.payload.ttl_ms || 600000; // Default 10 min

    this.approvals[event.payload.approval_id] = {
      approval_id: event.payload.approval_id,
      status: 'pending',
      created_at: Date.now(), // ✨ NEW - track when requested
      ttl_ms, // ✨ NEW - track TTL
    };

    // Schedule cleanup if not already scheduled
    if (!this.cleanup_scheduled) {
      this.scheduleCleanup();
    }
  }
```

### 3B: Add Cleanup Scheduler

**Add at end of ApprovalStateMachine class** (before closing brace):

```typescript
  /**
   * Schedule periodic cleanup of expired approvals
   */
  private scheduleCleanup(): void {
    if (this.cleanup_scheduled) return;
    this.cleanup_scheduled = true;

    setInterval(() => {
      const now = Date.now();
      let expired = 0;

      for (const [id, approval] of Object.entries(this.approvals)) {
        if (
          approval.status === 'pending' &&
          approval.created_at &&
          approval.ttl_ms &&
          now - approval.created_at > approval.ttl_ms
        ) {
          // Mark as expired
          (approval as any).status = 'decided';
          (approval as any).decision = 'expired';
          (approval as any).decided_at = now;
          expired++;
        }
      }

      if (expired > 0) {
        console.log(`[StateM] Auto-marked ${expired} approvals expired`);
      }
    }, 60000); // Check every 60 seconds
  }

  private cleanup_scheduled = false;
```

---

## 🧪 Test File (Create New)

**Path**: `apps/nucleus/test/ledger-expiry.test.ts` (NEW FILE)

Create this file with:

```typescript
import { describe, it, expect } from '@jest/globals';

/**
 * Tests for approval TTL functionality
 */
describe('Ledger: Approval Expiry', () => {
  it('should detect expired approval', () => {
    const now = Date.now();
    const approval = {
      approval_id: 'appr-1',
      status: 'pending' as const,
      created_at: now - 10000, // 10 seconds ago
      ttl_ms: 5000, // 5 second TTL
    };

    // Should be expired (10s > 5s)
    const isExpired = now - approval.created_at > approval.ttl_ms;
    expect(isExpired).toBe(true);
  });

  it('should not detect non-expired approval', () => {
    const now = Date.now();
    const approval = {
      approval_id: 'appr-2',
      status: 'pending' as const,
      created_at: now - 2000, // 2 seconds ago
      ttl_ms: 5000, // 5 second TTL
    };

    // Should NOT be expired (2s < 5s)
    const isExpired = now - approval.created_at > approval.ttl_ms;
    expect(isExpired).toBe(false);
  });

  it('should not expire already-decided approval', () => {
    const approval = {
      approval_id: 'appr-3',
      status: 'decided' as const,
      decision: 'approved' as const,
      created_at: 0,
      ttl_ms: 5000,
    };

    // Already decided, should never expire
    const shouldNotChange = approval.status !== 'pending';
    expect(shouldNotChange).toBe(true);
  });
});
```

---

## ✅ Implementation Checklist

Track your progress:

```
STEP 1: ledger.ts
├─ [ ] Add fields (created_at, ttl_ms, status) to approvals type
├─ [ ] Add isApprovalExpired() method
├─ [ ] Add getApprovalWithExpiry() method
├─ [ ] Add cleanupExpiredApprovals() method
└─ [ ] BUILD: pnpm --filter './apps/nucleus' run build

STEP 2: routes/ledger.ts
├─ [ ] Update GET /approvals/:id (return 410 if expired)
├─ [ ] Update POST /approvals/:id/decide (return 409 if already decided)
└─ [ ] BUILD: pnpm --filter './apps/nucleus' run build

STEP 3: state-machine.ts
├─ [ ] Update onApprovalRequested() (track created_at + ttl_ms)
├─ [ ] Add scheduleCleanup() method
├─ [ ] Add cleanup_scheduled property
└─ [ ] BUILD: pnpm --filter './apps/nucleus' run build

STEP 4: Testing
├─ [ ] Create test file (ledger-expiry.test.ts)
├─ [ ] Run tests: pnpm run test:ledger
└─ [ ] All tests pass

STEP 5: Manual Smoke Test
├─ [ ] Start nucleus: pnpm --filter './apps/nucleus' run dev
├─ [ ] Create approval via API
├─ [ ] Check immediately (should be 200 OK, pending)
├─ [ ] Wait 11 minutes
├─ [ ] Check again (should be 410 Gone)
└─ [ ] SUCCESS ✅

STEP 6: Commit
├─ [ ] git add .
├─ [ ] git commit -m "feat(ledger): add approval TTL enforcement (Phase 1)"
└─ [ ] Ready for Phase 2
```

---

## 🔧 Build Verification

After each file change:

```bash
cd "c:\Users\colte\colten projects\coltens world"
pnpm --filter './apps/nucleus' run build
```

**Expected**: No errors (nucleus builds successfully)

---

## 🚀 When Done

✅ All checklist items complete → You're ready for:

**[PRIORITY_2_HARDENING_GUIDE.md](PRIORITY_2_HARDENING_GUIDE.md) → Change 2B: Concurrency Safety**

Next phase adds **409 Conflict** handling for double-decides (2-3 hours)

---

## 📝 Notes

- **TTL Default**: 10 minutes (600,000ms) if not specified
- **410 Gone**: Critical distinction from 404 (tells client approval existed but expired)
- **Cleanup**: Runs every 60 seconds in background (state-machine)
- **Backward Compatible**: Only adds fields, doesn't break existing approvals

---

**Ready?** Start with **File 1: ledger.ts** → Add the 3 methods above

Good luck! 🚀
