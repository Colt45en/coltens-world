# AgentHub: Production-Ready Python + TypeScript Router

**Status**: ✅ Production-ready, CORS-enabled, approvals built-in, self-test included

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Your Chat UI (renders tool results)                         │
│  - Strips agent_ prefix from tool names                     │
│  - POSTs to http://127.0.0.1:3001/tool/execute             │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────▼──────────────────────────────────────────┐
         │ AgentHub (:3001)  — agent_hub_server.py         │
         │                                                  │
         │ Routing Rules:                                   │
         │ ┌──────────────────────────────────────────┐    │
         │ │ if action.kind starts with py. or hub.  │    │
         │ │   → Execute in FastAPI process          │    │
         │ └──────────────────────────────────────────┘    │
         │ ┌──────────────────────────────────────────┐    │
         │ │ if action.kind starts with ts.          │    │
         │ │   → Forward HTTP to TS Agent :3002      │    │
         │ └──────────────────────────────────────────┘    │
         └──┬─────────────────────────────────────┬─────────┘
            │                                     │
    ┌───────▼──────────────┐      ┌──────────────▼────────┐
    │ Python Runtime       │      │ TS Agent (:3002)      │
    │ (in-process)         │      │ (ts_agent_server.js)  │
    │                      │      │                       │
    │ py.echo              │      │ ts.health             │
    │ py.health            │      │ ts.uppercase          │
    │ py.time              │      │ ts.concat             │
    │ py.sha256            │      │ ts.json_parse         │
    │ py.require_approval  │      │ ts.words              │
    │                      │      │                       │
    │ hub.self_test        │      │                       │
    │ hub.list_tools       │      │                       │
    └──────────────────────┘      └───────────────────────┘
```

---

## Key Features

✅ **Prefix-based routing**: Tool name encodes backend (py.* vs ts.*)
✅ **CORS enabled**: Works with file:// origin and all origins
✅ **Approval gates**: Gate actions behind user approval (`py.require_approval`)
✅ **Self-test**: `hub.self_test` verifies both backends are reachable
✅ **Error codes**: Each failure includes code for UI handling
✅ **No UI changes needed**: Your existing chat window works as-is

---

## Files

| File | Purpose | Port |
|------|---------|------|
| `agent_hub_server.py` | FastAPI hub + Python tools | 3001 |
| `ts_agent_server.js` | Express TS agent | 3002 |
| `start-agenthub.bat` | Windows launcher | - |
| `start-agenthub.ps1` | PowerShell launcher | - |
| `QUICKSTART.md` | 60-second reference | - |
| `AGENTHUB_README.md` | This file | - |

---

## Quick Start (5 Minutes)

### 1. Install
```bash
npm i express
pip install fastapi uvicorn httpx
```

### 2. Start
```bash
# Windows batch
start-agenthub.bat

# Or PowerShell
.\start-agenthub.ps1

# Or manual (3 terminals)
node ts_agent_server.js
python agent_hub_server.py
# Keep your Nucleus server running on :3000
```

### 3. Verify

**Hub health:**
```bash
curl http://127.0.0.1:3001/health
```

**Both backends:**
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"action":{"kind":"hub.self_test"},"trace_id":"t","session_id":"s"}'
```

Expected: `{"success":true,"result":{"hub":{"ok":true},"python":{"ok":true},"typescript":{"ok":true}}}`

---

## Endpoints

### GET /health
```bash
curl http://127.0.0.1:3001/health
# {"ok": true, "agent": "hub", "now_ms": ...}
```

### POST /tool/execute
Execute a tool. AgentHub routes by `action.kind` prefix.

**Request:**
```json
{
  "action": {
    "kind": "py.echo",  // or "ts.uppercase", "hub.self_test"
    "msg": "hello"      // your tool args
  },
  "trace_id": "...",
  "session_id": "..."
}
```

**Response (success):**
```json
{
  "success": true,
  "result": { /* tool-specific result */ }
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "description",
  "code": "ERROR_CODE"  // for UI handling
}
```

### POST /tool/approve
Handle approval decisions.

**Request:**
```json
{
  "approval_id": "appr_...",
  "decision": "approve",  // or "reject"
  "reason": "ok"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "approval_id": "...",
    "decision": "approve",
    "approved_action": { /* the original action */ }
  }
}
```

---

## Tool Registry

### Python Tools (run in-process)

| Tool | Args | Returns |
|------|------|---------|
| `py.echo` | `{msg: string}` | echoed action + context |
| `py.health` | `{}` | `{status: "ok"}` |
| `py.time` | `{}` | `{now_ms, now_iso}` |
| `py.sha256` | `{text: string}` | `{sha256: hash, len}` |
| `py.require_approval` | `{note: string}` | `{requires_approval: true, approval_id}` |

### Hub Tools (system)

| Tool | Args | Returns |
|------|------|---------|
| `hub.self_test` | `{}` | `{hub, python, typescript backends}` |
| `hub.list_tools` | `{}` | `{py: [...], hub: [...], ts_note}` |

### TypeScript Tools (remote, forwarded via HTTP)

| Tool | Args | Returns |
|------|------|---------|
| `ts.health` | `{}` | `{ok: true}` |
| `ts.uppercase` | `{text: string}` | `{text, len}` |
| `ts.concat` | `{a: string, b: string}` | `{text}` |
| `ts.json_parse` | `{text: string}` | `{parsed: object}` |
| `ts.words` | `{text: string}` | `{words, count}` |

---

## Adding Custom Tools

### Add Python Tool

Edit `agent_hub_server.py`:

```python
async def py_my_custom_tool(action: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    # Your implementation
    return ok({"result": "..."})

# Register in PY_TOOLS
PY_TOOLS["py.my_custom_tool"] = py_my_custom_tool
```

Nucleus can now emit: `agent_py.my_custom_tool`

### Add TypeScript Tool

Edit `ts_agent_server.js`:

```js
tools["ts.my_custom_tool"] = async (action) => {
  // Your implementation
  return ok({result: "..."});
};
```

Nucleus can now emit: `agent_ts.my_custom_tool`

---

## Error Codes

| Code | Meaning |
|------|---------|
| `ERROR` | Generic error |
| `BAD_ARGS` | Invalid arguments (missing required field, wrong type) |
| `UNKNOWN_TOOL` | Tool not registered |
| `TS_HTTP_ERROR` | TS agent returned HTTP error (4xx/5xx) |
| `TS_UNREACHABLE` | Can't connect to TS agent on :3002 |
| `PY_TOOL_ERROR` | Python tool raised exception |
| `PY_RUNTIME_ERROR` | Python runtime error |
| `UNKNOWN_APPROVAL` | Approval ID not found |

Use these codes in your UI to provide context-specific error handling.

---

## Approval Flow Example

### Step 1: Request approval
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"kind": "py.require_approval", "note": "Grant access to file system"},
    "trace_id": "conv-123",
    "session_id": "user-456"
  }'
```

**Response:**
```json
{
  "success": true,
  "requires_approval": true,
  "approval_id": "appr_abc123...",
  "pending_action": {
    "kind": "py.approved_action",
    "note": "Grant access to file system",
    "payload": {...}
  }
}
```

### Step 2: User sees approval UI
Chat renders an approval card with **Approve** and **Reject** buttons.

### Step 3: User clicks Approve
```bash
curl -X POST http://127.0.0.1:3001/tool/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approval_id": "appr_abc123...",
    "decision": "approve",
    "reason": "I trust this action"
  }'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "approval_id": "appr_abc123...",
    "decision": "approve",
    "approved_action": {...}
  }
}
```

Chat shows: ✅ Approved

---

## CORS Policy

AgentHub allows:
- Origins: `*` (all)
- Credentials: `false`
- Methods: `*` (all)
- Headers: `*` (all)

This works even when UI is loaded as `file://` (no origin).

For production, whitelist specific origins:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    ...
)
```

---

## Testing Without Nucleus

### Test Python tool
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"kind": "py.sha256", "text": "hello"},
    "trace_id": "test",
    "session_id": "test"
  }'
```

### Test TypeScript tool (via hub)
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"kind": "ts.uppercase", "text": "hello"},
    "trace_id": "test",
    "session_id": "test"
  }'
```

### Test self-check
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"kind": "hub.self_test"},
    "trace_id": "test",
    "session_id": "test"
  }'
```

---

## Troubleshooting

### "TS agent unreachable"
1. Check `node ts_agent_server.js` is running on :3002
2. Verify no firewall blocks localhost:3002
3. Run `hub.self_test` to diagnose

### "Unknown tool kind: ts.foo"
1. Add `ts.foo` to `tools` object in `ts_agent_server.js`
2. Restart TS agent
3. Test with curl before Nucleus

### Port conflicts
```bash
# Check what's on port 3001/3002
netstat -an | findstr 300[1-2]

# Kill if needed
taskkill /F /PID <pid>
```

### CORS errors in browser
✅ AgentHub already allows all origins
✅ No changes needed for file:// origin

---

## Nucleus Integration Pattern

In Nucleus tool planning, decide by task type:

```python
# Pseudo-code in Nucleus planner
if task_type in ["text_ops", "json"]:
    tool_name = f"agent_ts.{task_specific_tool}"  # TypeScript
elif task_type in ["gui", "file_ops"]:
    tool_name = f"agent_py.{task_specific_tool}"  # Python
elif task_type in ["system"]:
    tool_name = f"agent_hub.{task_specific_tool}"  # Hub meta-tools
else:
    tool_name = "agent_hub.self_test"  # Default: verify backends
```

The UI will then:
1. Strip `agent_` prefix
2. POST to AgentHub
3. AgentHub routes to appropriate backend
4. Result renders in chat

---

## Monitoring

### Check both backends
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -d '{"action":{"kind":"hub.self_test"},"trace_id":"t","session_id":"s"}' \
  | jq '.result | {hub: .hub.ok, python: .python.ok, typescript: .typescript.ok}'
```

### Watch service logs
- **AgentHub**: Shows routing decisions, tool execution
- **TS Agent**: Shows incoming tool calls, results

### List available tools
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -d '{"action":{"kind":"hub.list_tools"},"trace_id":"t","session_id":"s"}' \
  | jq '.result'
```

---

## What's Next

1. ✅ Start services (`start-agenthub.bat`)
2. ✅ Test endpoints (curl examples above)
3. ✅ Verify self-test shows both backends ok
4. 📝 Have Nucleus emit `agent_py.*` and `agent_ts.*` tool names
5. 📝 Add custom Python/TS tools as needed
6. 📈 Monitor from production

---

## One Real Example: Nucleus Tool Call

If Nucleus wants to uppercase some text:

```json
{
  "type": "tool_use",
  "id": "call_xyz",
  "name": "agent_ts.uppercase",
  "input": {
    "text": "hello world"
  }
}
```

**UI processing:**
1. Sees `agent_ts.uppercase`
2. Strips `agent_` → `ts.uppercase`
3. POSTs to AgentHub:
   ```json
   POST /tool/execute
   {
     "action": {"kind": "ts.uppercase", "text": "hello world"},
     "trace_id": "conv-123",
     "session_id": "user-456"
   }
   ```
4. AgentHub sees `ts.` prefix, forwards to TS agent on :3002
5. TS agent responds:
   ```json
   {"success": true, "result": {"text": "HELLO WORLD", "len": 11}}
   ```
6. Chat renders:
   ```
   🔧 agent_ts.uppercase
   Result: HELLO WORLD (11 characters)
   ```

---

**Status**: ✅ Production-ready. All code is minimal, tested, and waiting.
