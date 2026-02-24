# AgentHub Deployment Checklist

**Purpose**: Step-by-step verification and deployment guide
**Status**: Ready for production

---

## Pre-Deployment: System Requirements

### Hardware
- [ ] 128MB RAM minimum (AgentHub + TS Agent)
- [ ] 100MB disk space for code + dependencies
- [ ] Supported on Windows/macOS/Linux

### Software
- [ ] Node.js 18+ (for TS Agent)
- [ ] Python 3.8+ (for AgentHub)
- [ ] npm or yarn (for Node deps)
- [ ] pip (for Python deps)
- [ ] curl or Postman (for testing)

### Network
- [ ] Ports 3001-3002 available on localhost
- [ ] No firewall blocks localhost connections
- [ ] (Optional) Static IPs if multi-machine deployment

---

## Phase 1: Installation (5 minutes)

### Step 1.1: Install Python Dependencies
```bash
cd "c:\Users\colte\colten projects\coltens world"
pip install fastapi uvicorn httpx
```

**Verify:**
```bash
pip show fastapi uvicorn httpx | grep Version
```

Expected output:
```
Name: fastapi
Version: 0.X.Y
...
```

### Step 1.2: Install Node Dependencies
```bash
npm i express
```

**Verify:**
```bash
npm ls express
```

Expected output:
```
your-project@1.0.0 ...
└── express@4.X.Y
```

### Step 1.3: Verify Files Exist
```bash
ls -la agent_hub_server.py ts_agent_server.js start-agenthub.*
```

Expected output:
```
-rw-r--r--  251 agent_hub_server.py
-rw-r--r--   90 ts_agent_server.js
-rw-r--r--  200 start-agenthub.bat
-rw-r--r--  150 start-agenthub.ps1
```

---

## Phase 2: Service Startup (2 minutes)

### Option A: Automated (Recommended)

#### Windows (Batch)
```bash
start-agenthub.bat
```

Two cmd windows open:
- Window 1: TS Agent (:3002)
- Window 2: AgentHub (:3001)

#### Windows (PowerShell)
```powershell
.\start-agenthub.ps1
```

Same result (two separate processes).

### Option B: Manual

#### Terminal 1 (TS Agent)
```bash
node ts_agent_server.js
```

Expected output:
```
TS Agent listening on port 3002
GET /health, POST /tool/execute available
```

#### Terminal 2 (AgentHub)
```bash
python agent_hub_server.py
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:3001
INFO:     Press CTRL+C to quit
```

---

## Phase 3: Connectivity Verification (3 minutes)

### Test 3.1: Hub Health
```bash
curl -v http://127.0.0.1:3001/health
```

**Expected Response (200):**
```json
{
  "ok": true,
  "agent": "hub",
  "now_ms": 1700000000000
}
```

**If failing:**
- [ ] AgentHub process running? Check `python agent_hub_server.py` terminal
- [ ] Port 3001 in use? Try: `netstat -an | grep 3001`
- [ ] Firewall blocking? Try disabling temporarily

### Test 3.2: TS Agent Health
```bash
curl -v http://127.0.0.1:3002/health
```

**Expected Response (200):**
```json
{
  "ok": true,
  "tools": ["ts.health", "ts.uppercase", "ts.concat", "ts.json_parse", "ts.words"]
}
```

**If failing:**
- [ ] TS Agent process running? Check `node ts_agent_server.js` terminal
- [ ] Port 3002 in use? Try: `netstat -an | grep 3002`

### Test 3.3: Hub Self-Test
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"action":{"kind":"hub.self_test"},"trace_id":"test","session_id":"test"}'
```

**Expected Response (200):**
```json
{
  "success": true,
  "result": {
    "hub": {"ok": true},
    "python": {"ok": true},
    "typescript": {"ok": true}
  }
}
```

**If any fails:**
- [ ] Check corresponding service terminal for errors
- [ ] Verify ports 3001 and 3002 both listening

---

## Phase 4: Tool Testing (5 minutes)

### Test 4.1: Python Tool
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"action":{"kind":"py.echo","msg":"hello"},"trace_id":"test","session_id":"test"}'
```

**Expected Response (200):**
```json
{
  "success": true,
  "result": {
    "action": {"kind": "py.echo", "msg": "hello"},
    "context": {"trace_id": "test", "session_id": "test", ...}
  }
}
```

**Troubleshooting:**
- [ ] code="UNKNOWN_TOOL": Tool not registered in PY_TOOLS
- [ ] code="PY_TOOL_ERROR": Exception in Python tool (check terminal)

### Test 4.2: TypeScript Tool (via Hub)
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"action":{"kind":"ts.uppercase","text":"hello"},"trace_id":"test","session_id":"test"}'
```

**Expected Response (200):**
```json
{
  "success": true,
  "result": {
    "text": "HELLO",
    "len": 5
  }
}
```

**Troubleshooting:**
- [ ] code="TS_UNREACHABLE": TS Agent not running on :3002
- [ ] code="TS_HTTP_ERROR": TS Agent returned error (check :3002 terminal)

### Test 4.3: Hub Meta-Tool
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"action":{"kind":"hub.list_tools"},"trace_id":"test","session_id":"test"}'
```

**Expected Response (200):**
```json
{
  "success": true,
  "result": {
    "py": ["py.echo", "py.health", "py.time", "py.sha256", "py.require_approval"],
    "hub": ["hub.self_test", "hub.list_tools"],
    "ts_note": "Forwarded to TS Agent on :3002"
  }
}
```

---

## Phase 5: Error Scenario Testing (3 minutes)

### Test 5.1: Invalid Tool
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"action":{"kind":"py.nonexistent"},"trace_id":"test","session_id":"test"}'
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Tool not registered: py.nonexistent",
  "code": "UNKNOWN_TOOL"
}
```

- [ ] code field present? Yes
- [ ] error message helpful? Yes

### Test 5.2: Missing Args
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"action":{"kind":"py.sha256"},"trace_id":"test","session_id":"test"}'
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Missing required field: text",
  "code": "BAD_ARGS"
}
```

- [ ] Returns BAD_ARGS code? Yes

### Test 5.3: TS Unreachable
(Kill TS Agent process first)

```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"action":{"kind":"ts.uppercase","text":"test"},"trace_id":"test","session_id":"test"}'
```

**Expected Response (503):**
```json
{
  "success": false,
  "error": "Cannot reach TypeScript agent on 127.0.0.1:3002",
  "code": "TS_UNREACHABLE"
}
```

- [ ] Returns TS_UNREACHABLE code? Yes
- [ ] Error message indicates action (restart TS Agent)? Yes

---

## Phase 6: Nucleus Integration (5 minutes)

### Step 6.1: Configure Nucleus

In your Nucleus planner/reasoning, ensure it can emit these tool names:
- `agent_py.echo`
- `agent_py.health`
- `agent_py.time`
- `agent_py.sha256`
- `agent_ts.uppercase`
- `agent_ts.concat`
- `agent_ts.json_parse`
- `agent_ts.words`
- `agent_hub.self_test`
- `agent_hub.list_tools`

### Step 6.2: Configure Chat UI

Verify your Chat UI:
- [ ] Strips `agent_` prefix from tool names (remove first 6 chars)
- [ ] POSTs to `http://127.0.0.1:3001/tool/execute`
- [ ] Includes `trace_id` and `session_id`
- [ ] Renders `success=true` results
- [ ] Renders `success=false` errors with code

### Step 6.3: Test End-to-End

Use existing Chat UI or manual request:

```bash
# Simulate Nucleus requesting py.echo
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "kind": "py.echo",
      "msg": "Test from Nucleus"
    },
    "trace_id": "conv-12345",
    "session_id": "user-6789"
  }'
```

- [ ] Returns success? Yes
- [ ] Result includes original action? Yes
- [ ] Chat UI can render result? Yes

---

## Maintenance Checklist

### Daily
- [ ] Services starting properly
- [ ] Health endpoints responding
- [ ] Error codes in responses

### Weekly
- [ ] Check service logs for errors
- [ ] Run hub.self_test manually
- [ ] Verify no port conflicts

### Monthly
- [ ] Update dependencies: `pip install --upgrade fastapi` and `npm update`
- [ ] Clean up old logs
- [ ] Monitor error code frequency

---

## Troubleshooting Decision Tree

```
AgentHub not starting?
├─ Port 3001 in use?
│  └─ netstat -an | grep 3001
│     └─ Kill process: taskkill /F /PID <pid>
├─ Python not found?
│  └─ Install Python 3.8+
│  └─ Add to PATH
├─ Dependencies missing?
│  └─ pip install fastapi uvicorn httpx
└─ Other?
   └─ Check agent_hub_server.py syntax: python -m py_compile agent_hub_server.py

TS Agent not starting?
├─ Port 3002 in use?
│  └─ npm list | grep 3002
│  └─ Kill process: taskkill /F /PID <pid>
├─ Node not found?
│  └─ Install Node.js 18+
├─ Dependencies missing?
│  └─ npm i express
└─ Other?
   └─ Check syntax: node -c ts_agent_server.js

Tools not responding?
├─ Both services running?
│  └─ Check process list: tasklist | findstr "node python"
├─ Ports listening?
│  └─ netstat -an | grep 300[1-2]
├─ Endpoint wrong?
│  └─ Verify http://127.0.0.1:3001 and :3002
└─ Service terminals show errors?
   └─ Read error messages carefully

Tool returns error code?
├─ UNKNOWN_TOOL
│  └─ Tool not registered
│  └─ Verify tool name spelling
├─ BAD_ARGS
│  └─ Missing or wrong argument
│  └─ Check tool docs in AGENTHUB_README.md
├─ TS_UNREACHABLE
│  └─ TS Agent not running
│  └─ Restart: node ts_agent_server.js
├─ TS_HTTP_ERROR
│  └─ TS Agent returned 4xx/5xx
│  └─ Check TS Agent terminal for error
└─ PY_TOOL_ERROR
   └─ Python tool raised exception
   └─ Check AgentHub terminal for traceback
```

---

## Performance Baselines

After deployment, verify performance:

| Metric | Expected | Acceptable | Alert |
|--------|----------|------------|-------|
| Hub /health latency | <10ms | <50ms | >100ms |
| py.echo latency | <5ms | <20ms | >50ms |
| ts.uppercase latency | <10ms | <50ms | >100ms |
| Memory (hub process) | 40MB | <100MB | >150MB |
| Memory (ts process) | 70MB | <120MB | >200MB |

**Measure:**
```bash
# Latency (use curl -w with time_total)
curl -w "\nTime: %{time_total}s\n" http://127.0.0.1:3001/health

# Memory (Windows)
tasklist | grep python
tasklist | grep node
# Or use Task Manager → Details tab
```

---

## Rollback Procedure

If something goes wrong:

1. **Stop services** (Ctrl+C in terminals or close batch windows)
2. **Revert files** (git restore or manual backup)
3. **Restart**: `start-agenthub.bat`
4. **Verify**: `curl http://127.0.0.1:3001/health`

If still broken:
- [ ] Clear node_modules: `rm -rf node_modules && npm i`
- [ ] Clear pip cache: `pip install --force-reinstall fastapi uvicorn httpx`
- [ ] Check Python version: `python --version` (should be 3.8+)

---

## Deployment Sign-Off

- [ ] All files exist and are readable
- [ ] Dependencies installed (pip + npm)
- [ ] Services start without errors
- [ ] Health endpoints responding
- [ ] Hub self-test passes
- [ ] Python tools callable
- [ ] TypeScript tools callable via hub
- [ ] Error codes present in responses
- [ ] Nucleus can emit agent_* tool names
- [ ] Integration tested end-to-end
- [ ] Performance baseline established
- [ ] Logs configured (optional but recommended)

**Deployment Date**: ____________
**Deployed By**: ____________
**Notes**: ____________

---

## Quick Reference Commands

```bash
# Start services (Windows)
start-agenthub.bat

# Start services (PowerShell)
.\start-agenthub.ps1

# Check hub health
curl http://127.0.0.1:3001/health

# Self-test both backends
curl -X POST http://127.0.0.1:3001/tool/execute \
  -d '{"action":{"kind":"hub.self_test"},"trace_id":"t","session_id":"s"}'

# List all tools
curl -X POST http://127.0.0.1:3001/tool/execute \
  -d '{"action":{"kind":"hub.list_tools"},"trace_id":"t","session_id":"s"}'

# Test Python tool
curl -X POST http://127.0.0.1:3001/tool/execute \
  -d '{"action":{"kind":"py.echo","msg":"test"},"trace_id":"t","session_id":"s"}'

# Test TypeScript tool
curl -X POST http://127.0.0.1:3001/tool/execute \
  -d '{"action":{"kind":"ts.uppercase","text":"test"},"trace_id":"t","session_id":"s"}'

# Kill processes (if needed)
taskkill /F /IM python.exe 2>nul || true
taskkill /F /IM node.exe 2>nul || true

# Install deps
pip install fastapi uvicorn httpx
npm i express

# Check ports
netstat -an | grep 300[1-2]
```

---

**Status**: Ready for deployment
**Last Updated**: Current session
**Next**: Follow Phase 1 to begin installation
