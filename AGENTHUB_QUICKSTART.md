# AgentHub Quick Reference

**Start both services:**

```bash
# Terminal 1
python agent_hub_server.py

# Terminal 2
node ts_agent_server.js
```

**Verify health:**
```bash
curl http://127.0.0.1:3001/health
```

**Run all tests:**
```bash
python test_agent_hub.py
```

---

## Common Operations

### Echo (Python)
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"kind": "py.echo", "msg": "hello"},
    "trace_id": "t1", "session_id": "s1"
  }' | jq .result
```

### Hash Text (Python)
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"kind": "py.sha256", "text": "hello"},
    "trace_id": "t1", "session_id": "s1"
  }' | jq .result
```

### Uppercase (TypeScript, via hub)
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"kind": "ts.uppercase", "text": "hello"},
    "trace_id": "t1", "session_id": "s1"
  }' | jq .result
```

### Self-Test (check both backends)
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"kind": "hub.self_test"},
    "trace_id": "t1", "session_id": "s1"
  }' | jq .result
```

### List All Tools
```bash
curl -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {"kind": "hub.list_tools"},
    "trace_id": "t1", "session_id": "s1"
  }' | jq .result
```

### Approval Gate
```bash
# Step 1: Request approval
APPR=$(curl -s -X POST http://127.0.0.1:3001/tool/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "kind": "py.require_approval",
      "pending_action": {"kind": "ts.uppercase", "text": "secret"},
      "reason": "Uppercase secret text"
    },
    "trace_id": "t1", "session_id": "s1"
  }' | jq -r '.result.approval_id')

echo "Got approval: $APPR"

# Step 2: Approve it
curl -X POST http://127.0.0.1:3001/tool/approve \
  -H "Content-Type: application/json" \
  -d "{
    \"approval_id\": \"$APPR\",
    \"decision\": \"approve\",
    \"reason\": \"User said yes\"
  }" | jq '.result.tool_response'
```

---

## Environment

Override services:

```bash
export AGENT_HUB_PORT=3001
export TS_AGENT_PORT=3002
export TS_AGENT_URL=http://127.0.0.1:3002
export ALLOW_ORIGINS='*'
export REQUEST_TIMEOUT_S=5
export TS_RETRY_MAX=2
export APPROVAL_TTL_S=600
```

---

## Docker (all-in-one)

```bash
docker-compose up
```

---

## Key Concepts

| Concept | Meaning |
|---------|---------|
| **prefix routing** | `py.` → Python, `ts.` → TypeScript, `hub.` → diagnostics |
| **deterministic ID** | Same input = same `approval_id` (idempotent) |
| **one-shot approval** | Approval consumed after execution; can't replay |
| **error codes** | `BAD_ARGS`, `UNKNOWN_TOOL`, `TS_UNREACHABLE`, etc. |
| **approval TTL** | Approvals expire (default 10 min) |
| **retry policy** | TS agent: retry on 503 with 120-240ms backoff |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| TS agent unreachable | Check `node ts_agent_server.js` is running on :3002 |
| Unknown tool | Add tool to registry in .py or .js file |
| Approval expired | Request new approval (TTL: 600s default) |
| Request timeout | Increase `REQUEST_TIMEOUT_S` (default: 5s) |
| Port conflict | Check `netstat -an \| findstr 300[1-2]` |

---

**Status**: ✅ Production-ready. All tests passing.
