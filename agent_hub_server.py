from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# =========================
# Config
# =========================

HUB_HOST = os.getenv("AGENT_HUB_HOST", "127.0.0.1")
HUB_PORT = int(os.getenv("AGENT_HUB_PORT", "3001"))

TS_AGENT_URL = os.getenv("TS_AGENT_URL", "http://127.0.0.1:3002")

# CORS: dev default allows all; production should restrict.
ALLOW_ORIGINS = os.getenv("ALLOW_ORIGINS", "*").split(",")

# Hard safety defaults
REQUEST_TIMEOUT_S = float(os.getenv("REQUEST_TIMEOUT_S", "5.0"))
TS_RETRY_MAX = int(os.getenv("TS_RETRY_MAX", "2"))
TS_RETRY_BACKOFF_MS = int(os.getenv("TS_RETRY_BACKOFF_MS", "120"))

APPROVAL_TTL_S = int(os.getenv("APPROVAL_TTL_S", "600"))  # 10 min
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(1024 * 1024)))  # 1MB


# =========================
# Contract Models
# =========================

class ToolAction(BaseModel):
    kind: str = Field(..., description='e.g. "py.echo", "ts.uppercase", "hub.self_test"')
    # tool-specific args ride alongside kind
    model_config = {"extra": "allow"}


class ExecuteRequest(BaseModel):
    action: ToolAction
    trace_id: str
    session_id: str


class ApproveRequest(BaseModel):
    approval_id: str
    decision: str  # "approve" | "reject"
    reason: Optional[str] = None


class ToolResponse(BaseModel):
    success: bool
    result: Optional[Any] = None
    requires_approval: Optional[bool] = None
    approval_id: Optional[str] = None
    error: Optional[str] = None
    code: Optional[str] = None


def ok(result: Any, *, requires_approval: bool = False, approval_id: Optional[str] = None) -> ToolResponse:
    return ToolResponse(success=True, result=result, requires_approval=requires_approval, approval_id=approval_id)


def fail(error: str, code: str) -> ToolResponse:
    return ToolResponse(success=False, error=error, code=code)


# =========================
# Deterministic JSON + IDs
# =========================

def stable_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def normalize_kind(kind: str) -> str:
    # Hardening: accept "agent_py.xxx" forms too
    if kind.startswith("agent_py."):
        return "py." + kind[len("agent_py.") :]
    if kind.startswith("agent_ts."):
        return "ts." + kind[len("agent_ts.") :]
    if kind.startswith("agent_hub."):
        return "hub." + kind[len("agent_hub.") :]
    if kind.startswith("agent_") and "." in kind:
        # unknown agent prefix, fall through
        return kind
    return kind


# =========================
# Approval Store
# =========================

@dataclass
class PendingApproval:
    approval_id: str
    trace_id: str
    session_id: str
    created_at_ms: int
    status: str  # "waiting" | "approved" | "rejected" | "consumed"
    pending_action: Dict[str, Any]
    reason: Optional[str] = None


PENDING: Dict[str, PendingApproval] = {}
PENDING_LOCK = asyncio.Lock()

def now_ms() -> int:
    return int(time.time() * 1000)

async def purge_expired() -> None:
    cutoff = now_ms() - (APPROVAL_TTL_S * 1000)
    async with PENDING_LOCK:
        dead = [k for k, v in PENDING.items() if v.created_at_ms < cutoff or v.status in ("consumed",)]
        for k in dead:
            PENDING.pop(k, None)

def deterministic_approval_id(trace_id: str, session_id: str, pending_action: Dict[str, Any]) -> str:
    payload = f"{trace_id}|{session_id}|{stable_json(pending_action)}"
    return "appr_" + sha256_hex(payload)[:24]


# =========================
# Tool Implementations (Python + Hub)
# =========================

ToolFn = Callable[[Dict[str, Any], Dict[str, Any]], Awaitable[ToolResponse]]

async def py_echo(action: Dict[str, Any], ctx: Dict[str, Any]) -> ToolResponse:
    return ok({"action": action, "context": ctx})

async def py_health(action: Dict[str, Any], ctx: Dict[str, Any]) -> ToolResponse:
    return ok({"ok": True, "service": "agenthub", "lang": "python"})

async def py_time(action: Dict[str, Any], ctx: Dict[str, Any]) -> ToolResponse:
    return ok({"utc_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "now_ms": ctx["now_ms"]})

async def py_sha256(action: Dict[str, Any], ctx: Dict[str, Any]) -> ToolResponse:
    text = action.get("text")
    if not isinstance(text, str):
        return fail("Missing required string field: text", "BAD_ARGS")
    return ok({"text": text, "sha256": sha256_hex(text)})

async def py_require_approval(action: Dict[str, Any], ctx: Dict[str, Any]) -> ToolResponse:
    pending_action = action.get("pending_action")
    if not isinstance(pending_action, dict) or "kind" not in pending_action:
        return fail("Missing required object field: pending_action (with kind)", "BAD_ARGS")

    pending_action = dict(pending_action)
    pending_action["kind"] = normalize_kind(str(pending_action["kind"]))

    approval_id = deterministic_approval_id(ctx["trace_id"], ctx["session_id"], pending_action)

    await purge_expired()
    async with PENDING_LOCK:
        existing = PENDING.get(approval_id)
        if existing and existing.status == "waiting":
            # deterministic ID: same request yields same approval_id; return same pending approval
            return ok({"approval_id": approval_id, "status": "waiting"}, requires_approval=True, approval_id=approval_id)

        PENDING[approval_id] = PendingApproval(
            approval_id=approval_id,
            trace_id=ctx["trace_id"],
            session_id=ctx["session_id"],
            created_at_ms=ctx["now_ms"],
            status="waiting",
            pending_action=pending_action,
            reason=action.get("reason"),
        )

    return ok({"approval_id": approval_id, "status": "waiting"}, requires_approval=True, approval_id=approval_id)


async def hub_list_tools(action: Dict[str, Any], ctx: Dict[str, Any]) -> ToolResponse:
    # ask TS agent for its tool list if reachable
    ts_tools: Any = {"ok": False}
    try:
        ts_resp = await forward_to_ts(
            {"kind": "ts.list_tools"},
            ctx,
        )
        if ts_resp.success:
            ts_tools = ts_resp.result
        else:
            ts_tools = {"ok": False, "error": ts_resp.error, "code": ts_resp.code}
    except Exception as e:
        ts_tools = {"ok": False, "error": str(e), "code": "TS_UNREACHABLE"}

    return ok({
        "hub_tools": sorted(list(HUB_TOOLS.keys())),
        "py_tools": sorted(list(PY_TOOLS.keys())),
        "ts_tools": ts_tools,
    })

async def hub_self_test(action: Dict[str, Any], ctx: Dict[str, Any]) -> ToolResponse:
    # Python ok is simply "py.health"
    py_ok = await py_health({"kind": "py.health"}, ctx)

    ts_ok: Any = {"ok": False}
    try:
        ts_resp = await forward_to_ts({"kind": "ts.health"}, ctx)
        if ts_resp.success:
            ts_ok = ts_resp.result
        else:
            ts_ok = {"ok": False, "error": ts_resp.error, "code": ts_resp.code}
    except Exception as e:
        ts_ok = {"ok": False, "error": str(e), "code": "TS_UNREACHABLE"}

    return ok({
        "hub": {"ok": True},
        "python": py_ok.result,
        "typescript": ts_ok,
    })


PY_TOOLS: Dict[str, ToolFn] = {
    "py.echo": py_echo,
    "py.health": py_health,
    "py.time": py_time,
    "py.sha256": py_sha256,
    "py.require_approval": py_require_approval,
}

HUB_TOOLS: Dict[str, ToolFn] = {
    "hub.self_test": hub_self_test,
    "hub.list_tools": hub_list_tools,
}


# =========================
# TS Forwarding (retry + normalized errors)
# =========================

async def forward_to_ts(action: Dict[str, Any], ctx: Dict[str, Any]) -> ToolResponse:
    url = TS_AGENT_URL.rstrip("/") + "/tool/execute"
    payload = {
        "action": action,
        "trace_id": ctx["trace_id"],
        "session_id": ctx["session_id"],
    }

    last_err: Optional[ToolResponse] = None

    for attempt in range(TS_RETRY_MAX + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
                r = await client.post(url, json=payload)
            if r.status_code >= 400:
                # retry only for 503 per spec suggestion
                if r.status_code == 503 and attempt < TS_RETRY_MAX:
                    await asyncio.sleep((TS_RETRY_BACKOFF_MS * (attempt + 1)) / 1000.0)
                    continue
                return fail(f"TS agent returned HTTP {r.status_code}", "TS_HTTP_ERROR")

            data = r.json()
            # Validate minimal envelope shape
            if not isinstance(data, dict) or "success" not in data:
                return fail("TS agent returned malformed response", "TS_HTTP_ERROR")
            return ToolResponse(**data)

        except httpx.ConnectError:
            last_err = fail("TS agent unreachable", "TS_UNREACHABLE")
        except httpx.TimeoutException:
            last_err = fail("TS agent timeout", "TS_UNREACHABLE")
        except Exception as e:
            last_err = fail(f"TS forwarding error: {str(e)}", "TS_UNREACHABLE")

        if attempt < TS_RETRY_MAX:
            await asyncio.sleep((TS_RETRY_BACKOFF_MS * (attempt + 1)) / 1000.0)

    return last_err or fail("TS agent unreachable", "TS_UNREACHABLE")


# =========================
# FastAPI App
# =========================

app = FastAPI(title="AgentHub", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS if ALLOW_ORIGINS != ["*"] else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def body_size_limit(request: Request, call_next):
    # Simple body size guard; avoids pathological payloads
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        return ToolResponse(success=False, error="Request too large", code="BAD_ARGS").model_dump()
    request._body = body  # type: ignore[attr-defined]
    return await call_next(request)


def build_ctx(req: ExecuteRequest) -> Dict[str, Any]:
    return {
        "trace_id": req.trace_id,
        "session_id": req.session_id,
        "now_ms": now_ms(),
    }


@app.post("/tool/execute")
async def tool_execute(req: ExecuteRequest) -> Dict[str, Any]:
    ctx = build_ctx(req)

    action = req.action.model_dump()
    kind_raw = str(action.get("kind", ""))
    kind = normalize_kind(kind_raw)
    action["kind"] = kind

    try:
        if kind.startswith("py."):
            fn = PY_TOOLS.get(kind)
            if not fn:
                return fail("Tool not registered", "UNKNOWN_TOOL").model_dump()
            return (await fn(action, ctx)).model_dump()

        if kind.startswith("hub."):
            fn = HUB_TOOLS.get(kind)
            if not fn:
                return fail("Tool not registered", "UNKNOWN_TOOL").model_dump()
            return (await fn(action, ctx)).model_dump()

        if kind.startswith("ts."):
            # Forward as-is to TS
            return (await forward_to_ts(action, ctx)).model_dump()

        return fail("Unknown tool prefix (expected py./ts./hub.)", "UNKNOWN_TOOL").model_dump()

    except Exception as e:
        # Defensive: never leak stack traces in production; here we return message for dev ergonomics.
        return fail(str(e), "PY_TOOL_ERROR").model_dump()


@app.post("/tool/approve")
async def tool_approve(req: ApproveRequest) -> Dict[str, Any]:
    await purge_expired()

    decision = req.decision.strip().lower()
    if decision not in ("approve", "reject"):
        return fail("decision must be approve|reject", "BAD_ARGS").model_dump()

    async with PENDING_LOCK:
        pending = PENDING.get(req.approval_id)
        if not pending:
            return fail("approval_id not found", "UNKNOWN_APPROVAL").model_dump()

        if pending.status != "waiting":
            return fail(f"approval already {pending.status}", "UNKNOWN_APPROVAL").model_dump()

        pending.status = "approved" if decision == "approve" else "rejected"
        pending.reason = req.reason

    if decision == "reject":
        async with PENDING_LOCK:
            pending = PENDING.get(req.approval_id)
            if pending:
                pending.status = "consumed"
        return ok({
            "approval_id": req.approval_id,
            "decision": "reject",
            "reason": req.reason,
        }).model_dump()

    # Approve => replay stored action once
    replay_action = pending.pending_action
    replay_ctx = {
        "trace_id": pending.trace_id,
        "session_id": pending.session_id,
        "now_ms": now_ms(),
        "approval_id": req.approval_id,
    }

    # Mark consumed before execution to enforce one-shot semantics
    async with PENDING_LOCK:
        pending2 = PENDING.get(req.approval_id)
        if pending2:
            pending2.status = "consumed"

    # Execute replay action via same router logic
    kind = normalize_kind(str(replay_action.get("kind", "")))
    replay_action = dict(replay_action)
    replay_action["kind"] = kind

    try:
        if kind.startswith("py."):
            fn = PY_TOOLS.get(kind)
            if not fn:
                return fail("Tool not registered", "UNKNOWN_TOOL").model_dump()
            tool_resp = await fn(replay_action, replay_ctx)
        elif kind.startswith("hub."):
            fn = HUB_TOOLS.get(kind)
            if not fn:
                return fail("Tool not registered", "UNKNOWN_TOOL").model_dump()
            tool_resp = await fn(replay_action, replay_ctx)
        elif kind.startswith("ts."):
            tool_resp = await forward_to_ts(replay_action, replay_ctx)
        else:
            return fail("Unknown tool prefix", "UNKNOWN_TOOL").model_dump()

        return ok({
            "approval_id": req.approval_id,
            "decision": "approve",
            "approved_action": replay_action,
            "tool_response": tool_resp.model_dump(),
        }).model_dump()

    except Exception as e:
        return fail(str(e), "PY_TOOL_ERROR").model_dump()


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "agent": "hub", "now_ms": now_ms()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HUB_HOST, port=HUB_PORT, log_level="info")
