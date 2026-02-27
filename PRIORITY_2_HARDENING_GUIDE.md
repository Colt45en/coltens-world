# Priority 2: Ledger Hardening Guide

## Overview

Transition from **functional checkpoint polling** (Priority 1) to **production-grade safety** (Priority 2).

**Three Critical Changes**:
1. **Approval Expiry** — TTLs prevent hanging approvals
2. **Concurrency Safety** — 409 Conflict vs 400 Bad Request distinction
3. **Auth Validation** — X-Ledger-Token header verification

**Impact**: Prevents data loss, race conditions, and unauthorized access.

---

## Change 1: Approval Expiry Enforcement

### Problem
Approvals currently hang forever if user doesn't decide. After 10 minutes, request should auto-reject.

### Files to Modify
- `apps/nucleus/src/ledger/ledger.ts` — Add TTL column + expiry check
- `apps/nucleus/src/routes/ledger.ts` — Return 410 Gone on expired approvals
- `apps/nucleus/src/approvals/state-machine.ts` — Mark expired approvals

### Implementation Steps

#### Step 1A: Ledger Schema (ledger.ts)
Add expiry tracking to approvals table:

```typescript
// In schema initialization:
approvals: {
  approval_id: string;
  decision?: 'approved' | 'rejected' | 'expired';
  decided_at?: number;
  created_at: number;              // ADD: track creation time
  ttl_ms: number;                  // ADD: expiry seconds (default: 600000 = 10min)
  status: 'pending' | 'decided';   // ADD: distinguish pending from expired
}
```

**Method to Add**:
```typescript
isApprovalExpired(approval: Approval, now: number = Date.now()): boolean {
  if (approval.status !== 'pending') return false;
  return (now - approval.created_at) > approval.ttl_ms;
}

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
    return { ...approval, status: 'decided', decision: 'expired' };
  }
  return approval;
}

// Cleanup task (runs periodically or on-demand)
async cleanupExpiredApprovals(): Promise<number> {
  const result = db.prepare(`
    UPDATE approvals
    SET status = 'decided', decision = 'expired'
    WHERE status = 'pending'
      AND (datetime('now') - datetime(created_at/1000, 'unixepoch')) > ttl_ms/1000
  `).run();
  return result.changes;
}
```

#### Step 1B: Routes Update (ledger.ts)
Modify `/approvals/:id` and `/approvals/:id/decide`:

```typescript
// GET /approvals/:id
app.get('/approvals/:id', (req, res) => {
  const approval = ledger.getApprovalWithExpiry(req.params.id);

  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }

  if (approval.decision === 'expired') {
    return res.status(410).json({  // 410 Gone
      error: 'Approval expired',
      expired_at: approval.expired_at,
      ttl_ms: approval.ttl_ms,
    });
  }

  res.json({ approval });
});

// POST /approvals/:id/decide
app.post('/approvals/:id/decide', (req, res) => {
  const approval = ledger.getApprovals(req.params.id);

  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }

  // Check expiry FIRST
  if (approval.decision === 'expired') {
    return res.status(410).json({
      error: 'Approval already expired',
      ttl_ms: approval.ttl_ms,
    });
  }

  // ... rest of decision logic
});
```

#### Step 1C: State Machine Update (state-machine.ts)
Add expiry check to `onApprovalRequested()`:

```typescript
onApprovalRequested(event: ApprovalRequestedEvent): void {
  const ttl_ms = event.payload.ttl_ms || 600000;  // Default 10 min

  this.approvals[event.payload.approval_id] = {
    approval_id: event.payload.approval_id,
    status: 'pending',
    created_at: Date.now(),  // ADD
    ttl_ms,                   // ADD
  };

  // Optional: Schedule auto-expiry cleanup
  if (!this.cleanup_scheduled) {
    this.scheduleCleanup();
  }
}

private scheduleCleanup(): void {
  if (this.cleanup_scheduled) return;
  this.cleanup_scheduled = true;

  // Run cleanup every 60s
  setInterval(async () => {
    const expired = await this.ledger.cleanupExpiredApprovals();
    if (expired > 0) {
      console.log(`[Approvals] Auto-cleaned ${expired} expired approvals`);
    }
  }, 60000);
}
```

### Testing
```bash
# Manual test
curl -X POST http://localhost:3000/approvals/appr-1 \
  -d '{"decision": "approved"}' \
  -H "Content-Type: application/json"

# After 10+ minutes (or with mocked time):
curl http://localhost:3000/approvals/appr-1
# Expected: 410 Gone (not 404 or 200 with pending)
```

---

## Change 2: Concurrency Safety (409 vs 400)

### Problem
Client can't distinguish "already decided" from "not found" when calling `/approvals/:id/decide` twice.

### Current (Broken)
```typescript
if (!approval) return res.status(400).json({ error: 'Not found' });
if (approval.decision) return res.status(400).json({ error: 'Already decided' });
```

**Issue**: Both return 400 → client can't retry intelligently.

### Fixed Behavior
```
POST /approvals/appr-123/decide
  ↓
Approval not found?     → 404 Not Found
Approval already decided? → 409 Conflict ← different!
Approval expired?       → 410 Gone
Decision recorded       → 200 OK
```

### Implementation

#### File: `apps/nucleus/src/routes/ledger.ts`

```typescript
// POST /approvals/:id/decide
async function decideApproval(req: Request, res: Response) {
  const { id: approval_id } = req.params;
  const { decision } = req.body as { decision: 'approved' | 'rejected' };

  // Validate decision
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({
      error: 'BAD_ARGS',
      code: 'INVALID_DECISION',
      message: 'decision must be "approved" or "rejected"',
    });
  }

  // CHECK 1: Not found
  const approval = ledger.getApproval(approval_id);
  if (!approval) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Approval ${approval_id} not found`,
    });
  }

  // CHECK 2: Expired
  if (ledger.isApprovalExpired(approval)) {
    return res.status(410).json({
      error: 'EXPIRED',
      message: 'Approval has expired',
      ttl_ms: approval.ttl_ms,
    });
  }

  // CHECK 3: Already decided (MUST be 409, not 400!)
  if (approval.decision) {
    return res.status(409).json({
      error: 'CONFLICT',
      code: 'ALREADY_DECIDED',
      message: `Approval already decided: ${approval.decision}`,
      existing_decision: approval.decision,
      decided_at: approval.decided_at,
    });
  }

  // Step 4: Record decision
  try {
    ledger.appendEvent({
      type: 'approval.decided',
      approval_id,
      decision,
      decided_at: Date.now(),
      decided_by: req.user?.id || 'unknown',
    });

    // Update in-memory state
    stateMachine.onApprovalDecision({ approval_id, decision });

    return res.status(200).json({
      approval_id,
      decision,
      decided_at: Date.now(),
    });
  } catch (error) {
    console.error(`[Ledger] Decision failed for ${approval_id}:`, error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to record approval decision',
    });
  }
}
```

### Client-Side Error Handling

```typescript
// Agent-server: ledger-integration.ts
private async waitForApproval(approvalId: string): Promise<boolean> {
  while (true) {
    try {
      const response = await fetch(`${this.config.ledger_url}/approvals/${approvalId}`);

      // 410 Gone = expired, auto-reject
      if (response.status === 410) {
        console.warn(`[Agent] Approval expired: ${approvalId}`);
        return false;
      }

      // 404 Not Found = doesn't exist, auto-reject
      if (response.status === 404) {
        console.warn(`[Agent] Approval not found: ${approvalId}`);
        return false;
      }

      // 200 OK = check decision
      if (response.ok) {
        const data = await response.json();
        if (data.approval?.decision === 'approved') return true;
        if (data.approval?.decision === 'rejected') return false;
      }

      // Retry after 1s
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn(`[Agent] Approval poll failed:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

---

## Change 3: Auth Token Validation

### Problem
Anyone can append events or decide approvals. No authentication.

### Solution: X-Ledger-Token Header

#### Step 1: Add Middleware
File: `apps/nucleus/src/routes/middleware.ts` (new file)

```typescript
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  authenticated: boolean;
  token?: string;
}

const VALID_TOKENS = new Set([
  process.env.LEDGER_TOKEN || 'dev-token-12345',
  process.env.LEDGER_ADMIN_TOKEN || 'dev-admin-12345',
]);

export function authLedgerToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.headers['x-ledger-token'] as string;

  if (!token || !VALID_TOKENS.has(token)) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid X-Ledger-Token header',
    });
  }

  req.authenticated = true;
  req.token = token;
  next();
}

export function optionalAuthLedgerToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.headers['x-ledger-token'] as string;
  req.authenticated = !!token && VALID_TOKENS.has(token);
  req.token = token;
  next();
}
```

#### Step 2: Apply to Routes
File: `apps/nucleus/src/routes/ledger.ts`

```typescript
import { authLedgerToken, optionalAuthLedgerToken } from './middleware';

// Protected: Require auth for writes
app.post('/ledger/append', authLedgerToken, async (req, res) => {
  // ... existing logic
});

app.post('/ledger/append-batch', authLedgerToken, async (req, res) => {
  // ... existing logic
});

app.post('/approvals/:id/decide', authLedgerToken, async (req, res) => {
  // ... existing logic
});

// Optional auth for reads (ok to read without token, but rate-limit differently)
app.get('/ledger/stream', optionalAuthLedgerToken, async (req, res) => {
  // ... existing logic
  // Could implement stricter rate limits for unauthenticated requests
});

app.get('/approvals/pending', authLedgerToken, async (req, res) => {
  // ... list pending (admin only)
});
```

#### Step 3: Environment Config
File: `.env` (or `docker-compose.yml`)

```bash
# Production (strong tokens)
LEDGER_TOKEN=sk-ledger-$(openssl rand -hex 32)
LEDGER_ADMIN_TOKEN=sk-admin-$(openssl rand -hex 32)

# Development
LEDGER_TOKEN=dev-token-12345
```

#### Step 4: Agent-Server Integration
File: `apps/agent-server/src/ledger-integration.ts`

```typescript
private async appendEventToLedger(event: any): Promise<void> {
  try {
    const token = process.env.LEDGER_TOKEN || 'dev-token-12345';

    const response = await fetch(`${this.config.ledger_url}/ledger/append`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ledger-Token': token,  // ADD
      },
      body: JSON.stringify(event),
    });

    if (response.status === 401) {
      throw new Error('Ledger authentication failed (invalid X-Ledger-Token)');
    }

    if (!response.ok) {
      throw new Error(`Ledger returned ${response.status}`);
    }
  } catch (error) {
    console.warn(`[Agent] Failed to append event:`, error);
    throw error;
  }
}
```

---

## Implementation Order

### Phase 1 (This PR): Safety
1. **Approval Expiry** (Change 1)
   - Add TTL column to schema
   - Add expiry check on GET/POST
   - Add cleanup job

2. **Concurrency Guards** (Change 2)
   - Change 400 → 409 on double-decide
   - Test with retry logic

### Phase 2 (Next PR): Auth
3. **Token Validation** (Change 3)
   - Middleware + protected routes
   - Agent integration
   - Env config

---

## Testing Strategy

### Unit Tests

**1. Expiry**
```typescript
it('should mark approval as expired after TTL', () => {
  const approval = ledger.getApproval(id);

  // Mock time +11 minutes
  const expired = ledger.isApprovalExpired(approval, now + 11*60*1000);
  expect(expired).toBe(true);
});
```

**2. Concurrency**
```typescript
it('should return 409 on double-decide', async () => {
  // First decide
  const r1 = await POST('/approvals/appr-1/decide', { decision: 'approved' });
  expect(r1.status).toBe(200);

  // Second decide (same approval)
  const r2 = await POST('/approvals/appr-1/decide', { decision: 'rejected' });
  expect(r2.status).toBe(409);
  expect(r2.json().code).toBe('ALREADY_DECIDED');
});
```

**3. Auth**
```typescript
it('should reject POST without X-Ledger-Token', async () => {
  const r = await POST('/ledger/append', event);
  expect(r.status).toBe(401);
  expect(r.json().error).toBe('UNAUTHORIZED');
});

it('should accept POST with valid token', async () => {
  const r = await POST('/ledger/append', event, {
    headers: { 'X-Ledger-Token': 'dev-token-12345' }
  });
  expect(r.status).toBe(200);
});
```

### Integration Tests

**Approval Expiry + Auto-Cleanup**
```typescript
it('should auto-cleanup expired approvals', async () => {
  // Create approval
  await POST('/approvals', { approval_id: 'appr-1', ttl_ms: 1000 });

  // Wait for expiry
  await wait(1500);

  // Check cleanup
  const result = await ledger.cleanupExpiredApprovals();
  expect(result).toBeGreaterThan(0);

  // Verify GET returns 410
  const r = await GET('/approvals/appr-1');
  expect(r.status).toBe(410);
});
```

**Race Condition: Two Agents Deciding**
```typescript
it('should handle concurrent decisions safely', async () => {
  const [r1, r2] = await Promise.all([
    POST('/approvals/appr-1/decide', { decision: 'approved' }),
    POST('/approvals/appr-1/decide', { decision: 'rejected' }),
  ]);

  // One succeeds (200), one gets 409
  const statuses = [r1.status, r2.status].sort();
  expect(statuses).toEqual([200, 409]);

  // Verify ledger only recorded one decision
  const history = ledger.callHistory('appr-1');
  const decisions = history.filter(e => e.type === 'approval.decided');
  expect(decisions).toHaveLength(1);
});
```

---

## Files to Modify (Checklist)

### Priority 2 PR
- [ ] `apps/nucleus/src/ledger/ledger.ts`
  - Add `created_at`, `ttl_ms`, `status` fields
  - Add `isApprovalExpired()`, `getApprovalWithExpiry()`, `cleanupExpiredApprovals()` methods

- [ ] `apps/nucleus/src/routes/ledger.ts`
  - Update `/approvals/:id` to check expiry (410 Gone)
  - Update `/approvals/:id/decide` to distinguish 404 vs 409
  - Add auth middleware (or Phase 2)

- [ ] `apps/nucleus/src/approvals/state-machine.ts`
  - Add TTL tracking in `onApprovalRequested()`
  - Add `scheduleCleanup()` for auto-expiry

- [ ] `apps/agent-server/src/ledger-integration.ts`
  - Update `waitForApproval()` to handle 410 Gone + 404
  - (Optional: Add X-Ledger-Token in Phase 2)

### Phase 2 PR (Auth)
- [ ] `apps/nucleus/src/routes/middleware.ts` (new file)
- [ ] `apps/nucleus/src/routes/ledger.ts` (apply middleware)
- [ ] `apps/agent-server/src/ledger-integration.ts` (add X-Ledger-Token header)
- [ ] `.env` / Docker config

---

## Deployment Considerations

### Backward Compatibility
- ✅ Expiry is opt-in (defaults to 10min TTL)
- ✅ 409 response is more specific (clients should already handle retries)
- ✅ Auth can be disabled with empty token check

### Database Migration
**SQLite schema changes** (if applicable):
```sql
-- In schema migration:
-- Add columns if using existing DB
ALTER TABLE approvals ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000);
ALTER TABLE approvals ADD COLUMN ttl_ms INTEGER DEFAULT 600000;
ALTER TABLE approvals ADD COLUMN status TEXT DEFAULT 'pending';
```

### Monitoring
Add alerts:
- `approvals.expired_count` — How many approvals expire per hour
- `approvals.double_decide_conflicts` — How many 409s per hour
- `ledger.auth_failures` — Unauthorized attempts per hour

---

## Summary

| Change | Files | Benefit | Risk |
|--------|-------|---------|------|
| Expiry | ledger.ts, routes, state-machine | Prevent hanging approvals | Low (opt-in TTL) |
| Concurrency | routes | Correct error semantics | Low (status code only) |
| Auth | middleware, routes | Prevent unauthorized writes | Medium (requires token mgmt) |

**Estimated Effort**: 4-6 hours (tests included)

**Recommendation**: Implement all three in single PR for cohesive "hardening" release.
