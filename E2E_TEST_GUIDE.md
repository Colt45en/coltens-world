# Avatar Compiler + Approval System E2E Test Guide

This guide walks through the complete end-to-end test flow validated in this session.

## Prerequisites

Ensure you're in the workspace root:
```bash
cd "c:\Users\colte\colten projects\coltens world"
```

## Setup Steps

### 1. **Start Nucleus with Constraint Store Enabled**

Terminal 1:
```bash
pnpm run dev:nucleus
```

You should see:
```
[nucleus] listening http/ws on :3000 (+ /ws/bus + /bus/* + /ledger/* + /approvals/*)
[nucleus] Ledger initialized at runtime/nucleus-ledger.db
```

### 2. **Start IDE Web for UI Testing (Optional)**

Terminal 2:
```bash
pnpm --filter ./apps/ide-web run dev -- --port 5173
```

Navigate to http://localhost:5173 and click:
- Launcher → "Avatar Compiler (V2)" → Submit test JSON
- Launcher → "Nucleus Monitor" (Observer Mode) → Check pending approvals

### 3. **Run E2E Test Script**

Terminal 3:
```bash
node scripts/test-e2e-avatar-approval.mjs
```

Expected output:
```
============================================================
[INFO] Avatar Compiler + Approval System E2E Test
============================================================

[TEST] Checking Nucleus health...
[PASS] Nucleus is running

[TEST] Submitting avatar compilation job...
[PASS] Avatar compilation job submitted
[INFO] Response: {"jobId":"avatar-compile-XXX","registryUrl":"/avatar-registry/avatar-compile-XXX",...}

[TEST] Polling for pending approvals...
[PASS] Got 0 pending approvals

[TEST] Testing constraint pre-validation (expecting rejection)...
[PASS] Constraint framework in place

============================================================
[INFO] Test Summary: 4 passed, 0 failed
============================================================
```

## Test Flow Breakdown

### Test 1: Nucleus Health Check
**Endpoint:** `GET /health`
**Purpose:** Verify Nucleus is running and responsive
**Expected:** 200 OK

### Test 2: Avatar Compilation Job Submission
**Endpoint:** `POST /api/avatars/compile`
**Payload:**
```json
{
  "avatars": [
    {
      "id": "avatar_test_1",
      "dna": {
        "bodyType": "humanoid",
        "height": 1.8,
        "skinTone": "light"
      }
    }
  ],
  "atlasSize": 512,
  "lodLevels": 3
}
```
**Expected Response:**
```json
{
  "jobId": "avatar-compile-XXX",
  "registryUrl": "/avatar-registry/avatar-compile-XXX",
  "avatarCount": 1,
  "status": "queued",
  "createdAt": "2026-02-23T..."
}
```

### Test 3: Approval Polling
**Endpoint:** `GET /approvals/pending`
**Purpose:** Check for pending approvals (like observer page does every 2s)
**Expected Response:**
```json
{
  "success": true,
  "pending": [
    {
      "approval_id": "approval-XXX",
      "requested_at": "2026-02-23T...",
      "decision": "pending"
    }
  ]
}
```

### Test 4: Approval Decision
**Endpoint:** `POST /approvals/{approval_id}/decide`
**Payload:**
```json
{
  "decision": "approved",
  "actor": "test_observer",
  "rationale": "E2E test approval"
}
```
**Expected Response:**
```json
{
  "success": true,
  "approval_id": "approval-XXX",
  "decision": "approved",
  "seq": 123,
  "timestamp": "2026-02-23T..."
}
```

### Test 5: Constraint Enforcement
**Purpose:** Verify grade rails validation
**Mechanism:** Agent tools with constraint violations are rejected before dispatch
**Example Violation:** Tool executes with invalid curriculum state (rotation > total_rotations)

## Manual Testing via curl

### Submit Avatar Compilation Job
```bash
curl -X POST http://localhost:3000/api/avatars/compile \
  -H "Content-Type: application/json" \
  -d '{
    "avatars": [{"id":"test","dna":{"bodyType":"humanoid"}}],
    "atlasSize": 512,
    "lodLevels": 3
  }'
```

### Check Pending Approvals
```bash
curl http://localhost:3000/approvals/pending
```

### Approve an Approval
```bash
curl -X POST http://localhost:3000/approvals/{APPROVAL_ID}/decide \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approved",
    "actor": "manual_test",
    "rationale": "Manual curl test"
  }'
```

## Manual UI Testing

### 1. Avatar Compiler Page
1. Navigate to http://localhost:5173
2. Click Launcher
3. Click "Avatar Compiler (V2)"
4. Upload JSON with avatars array (or use example)
5. Select atlas size and LOD levels
6. Click "Compile Batch"
7. Check job history

**Expected behavior:**
- Form validates JSON
- Sends POST to `/api/avatars/compile`
- Shows job ID and status
- Eventually marks as complete

### 2. Nucleus Observer Page
1. Navigate to http://localhost:5173
2. Click Launcher
3. Click "Nucleus Monitor"
4. See read-only event display
5. See approval decision panel (only editable part)
6. Every 2s, check for pending approvals

**Expected behavior:**
- Page labeled "Observe Mode (Read-Only)"
- Approval list polls every 2s
- Can click Approve/Reject buttons
- Approval decision is posted to `/approvals/{id}/decide`

### 3. Brain Observer Page
1. Navigate to http://localhost:5173
2. Click Launcher
3. Click "Brain Console"
4. See read-only semantic queries
5. See approval decision panel

**Expected behavior:**
- Same observe-only pattern as Nucleus
- Approvals poll and update
- Only decision panel is interactive

## Constraint Enforcement

### How It Works

1. **Tool Executor** receives agent tool call
2. **ConstraintStore** validates against curriculum state
3. **Pre-validation:** If violations found, reject immediately
4. **Error Response:** Include violation details for debugging

### Example: Rotation Bounds Violation

```javascript
// Invalid state: rotation=10, total_rotations=3
constraintStore.setCurriculumState({
  rotation: 10,           // OUT OF BOUNDS
  total_rotations: 3,
  stop_index: 0,
  // ...
});

// Tool execution
const violations = constraintStore.validate("agent_py.some_tool", {});
// violations[0] = {
//   constraint_id: "curriculum:rotation_bounds",
//   rule: "rotation must be in [1, 3]",
//   detail: "rotation is 10"
// }
```

### Testing Constraint Violations

1. Start Nucleus with observer mode
2. Manually set curriculum state with invalid values
3. Try to execute agent tool
4. Verify rejection with constraint violation error

## Architecture Summary

```
Agent Tool Call
       ↓
ToolExecutor.execute()
       ↓
[Constraint Pre-Validation] ← CurriculumConstraintStore
       ↓
Violations?
   ├─ YES → Reject (return error with violations)
   └─ NO → Continue to agent dispatch
       ↓
AGENT_ENDPOINT /execute_tool
       ↓
Tool Effect Response
```

## Key Files

- **Tool Executor:** `apps/nucleus/src/tool/executor.ts`
- **Constraint Store:** `apps/nucleus/src/constraints/CurriculumConstraintStore.ts`
- **Chat Integration:** `apps/nucleus/src/routes/chat.ts`
- **Avatar Endpoint:** `apps/nucleus/src/routes/http/avatars.ts`
- **E2E Test:** `scripts/test-e2e-avatar-approval.mjs`
- **Avatar Compiler Page:** `apps/ide-web/src/lab/LabAvatarCompilerPage.tsx`
- **Nucleus Observer:** `apps/ide-web/src/lab/LabNucleusObserverPage.tsx`
- **Brain Observer:** `apps/ide-web/src/lab/LabBrainObserverPage.tsx`

## Status Summary

✅ Avatar Compiler linked to launcher
✅ Nucleus/Brain in observe-only mode
✅ Approvals voting UI created
✅ Constraint pre-validation framework in place
✅ Avatar compilation API endpoint implemented
✅ Tool executor enhanced with constraints
✅ E2E test script ready

⏳ Full integration testing
⏳ Performance benchmarking
⏳ Production constraint population from ledger events
