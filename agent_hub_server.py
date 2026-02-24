"""
AgentHub - Production-ready Python + TypeScript router

Run:
  pip install fastapi uvicorn httpx
  python agent_hub_server.py

Routing:
  - py.*/hub.* → executed in-process
  - ts.* → forwarded to TS agent on :3002

CORS:
  - Allows file:// origin (for browser-based UI)
  - Allows all origins for dev mode
"""

from __future__ import annotations

import hashlib
import time
import uuid
from typing import Any, Awaitable, Callable, Dict, Optional, TypedDict, cast

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ============ Basics ============

def now_ms() -> int:
    return int(time.time() * 1000)


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def ok(result: Any) -> Dict[str, Any]:
    return {"success": True, "result": result}


def fail(error: str, *, code: str = "ERROR") -> Dict[str, Any]:
    return {"success": False, "error": error, "code": code}


# ============ Request Models ============

class ExecuteBody(BaseModel):
    action: Dict[str, Any] = Field(..., description="Must include action.kind")
    trace_id: str
    session_id: str


class ApproveBody(BaseModel):
    approval_id: str
    decision: str  # approve | reject
    reason: Optional[str] = None


# ============ Approval Store ============

class PendingApproval(TypedDict):
    approval_id: str
    created_ms: int
    trace_id: str
    session_id: str
    tool_kind: str
    pending_action: Dict[str, Any]


PENDING: Dict[str, PendingApproval] = {}


def make_approval_id(trace_id: str, tool_kind: str) -> str:
    return f"appr_{sha256_hex(f'{trace_id}:{tool_kind}:{uuid.uuid4()}')[:24]}"


# ============ Tool Type ============

ToolFn = Callable[[Dict[str, Any], Dict[str, Any]], Awaitable[Dict[str, Any]]]


# ============ Python Tools ============

async def py_echo(action: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    return ok({"agent": "py", "echo": action, "ctx": ctx})


async def py_health(_action: Dict[str, Any], _ctx: Dict[str, Any]) -> Dict[str, Any]:
    return ok({"status": "ok", "agent": "py", "now_ms": now_ms()})


async def py_time(_action: Dict[str, Any], _ctx: Dict[str, Any]) -> Dict[str, Any]:
    return ok({"now_ms": now_ms(), "now_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})


async def py_sha256(action: Dict[str, Any], _ctx: Dict[str, Any]) -> Dict[str, Any]:
    text = action.get("text", "")
    if not isinstance(text, str):
        return fail("py.sha256 expects { text: string }", code="BAD_ARGS")
    return ok({"sha256": sha256_hex(text), "len": len(text)})


async def py_require_approval(action: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Gate an action behind user approval"""
    pending_action = {"kind": "py.approved_action", "note": action.get("note", "no note"), "payload": action}
    approval_id = make_approval_id(ctx["trace_id"], "py.require_approval")
    PENDING[approval_id] = {
        "approval_id": approval_id,
        "created_ms": now_ms(),
        "trace_id": ctx["trace_id"],
        "session_id": ctx["session_id"],
        "tool_kind": "py.require_approval",
        "pending_action": pending_action,
    }
    return {
        "success": True,
        "requires_approval": True,
        "approval_id": approval_id,
        "pending_action": pending_action,
    }


# ============ Hub Tools ============

async def hub_self_test(_action: Dict[str, Any], _ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Verify both Python and TypeScript backends are reachable"""
    py = {"ok": True, "agent": "py", "now_ms": now_ms()}
    ts: Dict[str, Any]
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get("http://127.0.0.1:3002/health")
            r.raise_for_status()
            ts = cast(Dict[str, Any], r.json())
    except Exception as e:
        ts = {"ok": False, "error": f"{type(e).__name__}: {e}"}

    return ok({"hub": {"ok": True, "now_ms": now_ms()}, "python": py, "typescript": ts})


async def hub_list_tools(_action: Dict[str, Any], _ctx: Dict[str, Any]) -> Dict[str, Any]:
    """List available tools"""
    return ok(
        {
            "py": sorted([k for k in PY_TOOLS.keys() if k.startswith("py.")]),
            "hub": sorted([k for k in PY_TOOLS.keys() if k.startswith("hub.")]),
            "ts_note": "ts.* tools are hosted by TypeScript Agent at :3002",
        }
    )


# ============ Tool Registry ============

PY_TOOLS: Dict[str, ToolFn] = {
    "py.echo": py_echo,
    "py.health": py_health,
    "py.time": py_time,
    "py.sha256": py_sha256,
    "py.require_approval": py_require_approval,
    "hub.self_test": hub_self_test,
    "hub.list_tools": hub_list_tools,
}


# ============ FastAPI App ============

app = FastAPI(title="AgentHub (Python + TypeScript Router)", version="1.0")

# CORS: Allow file:// and all origins for dev mode
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "agent": "hub", "now_ms": now_ms()}


@app.post("/tool/execute")
async def tool_execute(body: ExecuteBody) -> Dict[str, Any]:
    """Execute a tool, routing by prefix"""
    action = body.action
    kind = action.get("kind")
    if not isinstance(kind, str) or not kind:
        raise HTTPException(status_code=400, detail="Missing action.kind")

    ctx = {"trace_id": body.trace_id, "session_id": body.session_id}

    # Route ts.* -> TypeScript agent
    if kind.startswith("ts."):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    "http://127.0.0.1:3002/tool/execute",
                    json={"action": action, "trace_id": body.trace_id, "session_id": body.session_id},
                )
                if r.status_code >= 400:
                    return fail(f"TS agent error {r.status_code}: {r.text}", code="TS_HTTP_ERROR")
                return cast(Dict[str, Any], r.json())
        except Exception as e:
            return fail(f"TS agent unreachable: {type(e).__name__}: {e}", code="TS_UNREACHABLE")

    # Route py.* or hub.* -> local python tool
    fn = PY_TOOLS.get(kind)
    if fn is None:
        return fail(f"Unknown tool kind: {kind}", code="UNKNOWN_TOOL")

    try:
        return await fn(action, ctx)
    except Exception as e:
        return fail(f"{type(e).__name__}: {e}", code="PY_TOOL_ERROR")


@app.post("/tool/approve")
async def tool_approve(body: ApproveBody) -> Dict[str, Any]:
    """Handle approval decisions"""
    if body.decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="decision must be approve|reject")

    pending = PENDING.get(body.approval_id)
    if pending is None:
        return fail(f"Unknown approval_id: {body.approval_id}", code="UNKNOWN_APPROVAL")

    # Remove so approvals are one-shot
    PENDING.pop(body.approval_id, None)

    if body.decision == "reject":
        return ok(
            {
                "approval_id": body.approval_id,
                "decision": "reject",
                "reason": body.reason or "",
                "rejected_action": pending["pending_action"],
            }
        )

    # decision == approve
    return ok(
        {
            "approval_id": body.approval_id,
            "decision": "approve",
            "reason": body.reason or "",
            "approved_action": pending["pending_action"],
        }
    )


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🚀 AgentHub starting...")
    print("=" * 70)
    print("\n📍 Base: http://127.0.0.1:3001")
    print("   /health             → Status (both backends)")
    print("   /tool/execute       → Route tools")
    print("   /tool/approve       → Approvals")
    print(f"\n🐍 Python tools: {', '.join(PY_TOOLS.keys())}")
    print("🔗 TS agent: http://127.0.0.1:3002")
    print("⚡ CORS: Enabled for file:// and all origins (dev mode)")
    print("=" * 70 + "\n")

    uvicorn.run("agent_hub_server:app", host="127.0.0.1", port=3001, reload=False)
