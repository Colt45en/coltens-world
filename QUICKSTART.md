# AgentHub: Quick Reference

## What

Single endpoint routing calls to **Python** (`py.*`) and **TypeScript** (`ts.*`) agent backends.

```
Your Chat UI
  ├─ Strips `agent_` prefix
  └─ POST http://127.0.0.1:3001/tool/execute
       └─ AgentHub routes by prefix
            ├─ py.* → Python (in-process)
            ├─ hub.* → System tools
            └─ ts.* → TS Agent (:3002)
```

## Start (60 Seconds)

### Install
```bash
npm i express
pip install fastapi uvicorn httpx
```

### Run
```bash
start-agenthub.bat  # Windows
# or
.\start-agenthub.ps1  # PowerShell
# or manually:
node ts_agent_server.js &
python agent_hub_server.py
```

### Test
```bash
curl http://127.0.0.1:3001/health
# {"ok": true, "agent": "hub", ...}

curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{"action":{"kind":"hub.self_test"},"trace_id":"t","session_id":"s"}'
# Both backends "ok": true
```

## Tools

### Python
- `py.echo` — echo action
- `py.health` — status
- `py.time` — current time (ISO)
- `py.sha256` — hash text
- `py.require_approval` — gate behind approval

### Hub
- `hub.self_test` — verify both backends
- `hub.list_tools` — available tools

### TypeScript
- `ts.health` — status
- `ts.uppercase` — uppercase text
- `ts.concat` — join strings
- `ts.json_parse` — parse JSON
- `ts.words` — split into words

## Nucleus Integration

Emit tool calls with **prefix**:

```json
{
  "type": "tool_use",
  "name": "agent_py.echo",  // or agent_ts.*, agent_hub.*
  "input": {"msg": "hello"}
}
```

Your UI will:
1. Strip `agent_` → `py.echo`
2. POST to AgentHub
3. Route to appropriate backend
4. Show result in chat

## Add a Tool

**Python** (`agent_hub_server.py`):
```python
async def py_my_tool(action, ctx):
    return ok({"result": "..."})

PY_TOOLS["py.my_tool"] = py_my_tool
```

**TypeScript** (`ts_agent_server.js`):
```js
tools["ts.my_tool"] = async (action) => {
  return ok({result: "..."});
};
```

## CORS

✅ Enabled for `file://` origin (browser dev mode)
✅ Allows all origins for dev

## Approval Gate

Request:
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -d '{"action":{"kind":"py.require_approval","note":"do it"},...}'

# Returns: {requires_approval: true, approval_id: "...", pending_action: {...}}
```

Approve:
```bash
curl -X POST http://127.0.0.1:3001/tool/approve \
  -d '{"approval_id":"...","decision":"approve","reason":"ok"}'
```

## Status Codes

- `ERROR` — generic error
- `BAD_ARGS` — invalid input
- `UNKNOWN_TOOL` — tool not registered
- `TS_HTTP_ERROR` — TS agent HTTP error
- `TS_UNREACHABLE` — can't connect to TS agent
- `PY_TOOL_ERROR` — Python runtime error
- `UNKNOWN_APPROVAL` — approval_id not found
