from __future__ import annotations

import json
import time

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .schemas import ToolExecuteRequest, ToolExecuteResponse, ToolApproveRequest
from .policy import classify_action, requires_desktop, requires_user_approval
from .audit import audit_tool_event
from pathlib import Path
from .file_organizer_core import build_plan, apply_plan
from .store import create_pending, get_pending, delete_pending

DESKTOP_HOST_EXEC = "http://127.0.0.1:3002/desktop/execute"

app = FastAPI(title="World Engine Tool Server", version="1.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Map agent_ tool names to desktop actions
TOOL_NAME_TO_ACTION = {
    "agent_screenshot": {"kind": "screenshot"},
    "agent_left_click": lambda args: {
        "kind": "left_click",
        "x": args.get("x", 0),
        "y": args.get("y", 0),
    },
    "agent_right_click": lambda args: {
        "kind": "right_click",
        "x": args.get("x", 0),
        "y": args.get("y", 0),
    },
    "agent_double_click": lambda args: {
        "kind": "double_click",
        "x": args.get("x", 0),
        "y": args.get("y", 0),
    },
    "agent_type": lambda args: {"kind": "type", "text": args.get("text", "")},
    "agent_key": lambda args: {"kind": "key", "key": args.get("key", "")},
    "agent_scroll": lambda args: {
        "kind": "scroll",
        "direction": args.get("direction", "down"),
        "amount": args.get("amount", 3),
    },
    "agent_mouse_move": lambda args: {
        "kind": "mouse_move",
        "x": args.get("x", 0),
        "y": args.get("y", 0),
    },
}


@app.get("/health")
def health():
    return {"ok": True, "ts": time.time()}


def _map_tool_to_action(tool_name: str, tool_args: dict) -> dict:
    """Map tool names to desktop actions."""
    if tool_name == "computer":
        action = tool_args.get("action")
        if action == "left_click":
            coord = tool_args.get("coordinate", [0, 0])
            return {"kind": "left_click", "x": coord[0], "y": coord[1]}
        elif action == "right_click":
            coord = tool_args.get("coordinate", [0, 0])
            return {"kind": "right_click", "x": coord[0], "y": coord[1]}
        elif action == "double_click":
            coord = tool_args.get("coordinate", [0, 0])
            return {"kind": "double_click", "x": coord[0], "y": coord[1]}
        elif action == "mouse_move":
            coord = tool_args.get("coordinate", [0, 0])
            return {"kind": "mouse_move", "x": coord[0], "y": coord[1]}
        elif action == "type":
            return {"kind": "type", "text": tool_args.get("text", "")}
        elif action == "key":
            return {"kind": "key", "key": tool_args.get("key", "")}
        elif action == "scroll":
            direction = tool_args.get("scroll_direction", "down")
            amount = tool_args.get("scroll_amount", 3)
            return {"kind": "scroll", "direction": direction, "amount": amount}
        elif action == "screenshot":
            region = tool_args.get("region")
            if region:
                return {"kind": "screenshot", "region": region}
            else:
                return {"kind": "screenshot"}
        # Add other actions as needed
    elif tool_name in TOOL_NAME_TO_ACTION:
        mapping = TOOL_NAME_TO_ACTION[tool_name]
        if callable(mapping):
            return mapping(tool_args)
        else:
            return mapping
    # Fallback: assume tool_name is already an action kind
    return {"kind": tool_name, **tool_args}


def _execute_action(req: ToolExecuteRequest) -> ToolExecuteResponse:
    """
    Execute action now (after policy+approval checks have passed).
    """
    action = req.action
    trace_id = req.trace_id
    session_id = req.session_id

    audit_tool_event("tool.execute.begin", trace_id, session_id, {"action": action})

    if requires_desktop(action):
        try:
            r = requests.post(
                DESKTOP_HOST_EXEC,
                json={"action": action, "trace_id": trace_id, "session_id": session_id},
                timeout=30,
            )
            data = (
                r.json()
                if r.headers.get("content-type", "").startswith("application/json")
                else {}
            )
            ok = bool(data.get("success"))
            res = data.get("result") or {}
            err = data.get("error")

            audit_tool_event(
                "tool.execute.desktop",
                trace_id,
                session_id,
                {"ok": ok, "error": err, "action": action},
            )
            return ToolExecuteResponse(success=ok, result=res, error=err)
        except requests.RequestException as e:
            audit_tool_event(
                "tool.execute.error",
                trace_id,
                session_id,
                {"error": str(e), "action": action},
            )
            return ToolExecuteResponse(
                success=False, result={}, error=f"Desktop host unreachable: {e}"
            )

    # Headless (stub)
    audit_tool_event("tool.execute.headless", trace_id, session_id, {"action": action})
    return ToolExecuteResponse(
        success=True, result={"note": "Headless tool executed (stub)"}, error=None
    )


@app.post("/tool/execute", response_model=ToolExecuteResponse)
def tool_execute(req: ToolExecuteRequest):
    # Map agent_ tool names to actions
    action = _map_tool_to_action(req.action.get("name", ""), req.action)

    audit_tool_event("tool.request", req.trace_id, req.session_id, {"action": action})

    ok, reason = classify_action(action)
    if not ok:
        audit_tool_event(
            "tool.denied",
            req.trace_id,
            req.session_id,
            {"reason": reason, "action": action},
        )
        return ToolExecuteResponse(success=False, result={}, error=reason)

    # ---------------------------------------------------------
    # NEW: File Organizer tool (headless, approval-aware)
    # ---------------------------------------------------------
    kind = str(action.get("kind", "")).strip().lower()
    if kind == "file_organizer.run":
        try:
            schema_path = Path(str(action["schema_path"])).resolve()
            ruleset_path = Path(str(action["ruleset_path"])).resolve()
            sandbox_root = Path(str(action["sandbox_root"])).resolve()
            apply_requested = bool(action.get("apply", False))
        except Exception as e:
            return ToolExecuteResponse(
                success=False, result={}, error=f"Invalid file_organizer args: {e}"
            )

        # Always plan first
        audit_tool_event(
            "file_organizer.plan.begin",
            req.trace_id,
            req.session_id,
            {
                "schema_path": str(schema_path),
                "ruleset_path": str(ruleset_path),
                "sandbox_root": str(sandbox_root),
                "apply_requested": apply_requested,
            },
        )

        try:
            plan = build_plan(
                schema_path=schema_path,
                ruleset_path=ruleset_path,
                sandbox_root=sandbox_root,
            )
        except Exception as e:
            audit_tool_event(
                "file_organizer.plan.error",
                req.trace_id,
                req.session_id,
                {"error": str(e)},
            )
            return ToolExecuteResponse(
                success=False, result={}, error=f"Plan failed: {e}"
            )

        audit_tool_event(
            "file_organizer.plan.done",
            req.trace_id,
            req.session_id,
            {"summary": plan["summary"]},
        )

        # If not applying, return plan summary
        if not apply_requested:
            return ToolExecuteResponse(
                success=True,
                result={"mode": "plan", "summary": plan["summary"]},
                error=None,
            )

        # Applying requested: if plan contains risky ops, require approval
        if plan["summary"]["requires_approval_to_apply"]:
            action_json = json.dumps(action, ensure_ascii=False, sort_keys=True)
            approval_id = create_pending(
                req.trace_id,
                req.session_id,
                action_json,
                "file_organizer_apply_requires_approval",
            )

            audit_tool_event(
                "tool.approval.requested",
                req.trace_id,
                req.session_id,
                {
                    "approval_id": approval_id,
                    "reason": "file_organizer_apply_requires_approval",
                    "plan_summary": plan["summary"],
                },
            )

            return ToolExecuteResponse(
                success=False,
                result={"mode": "plan", "summary": plan["summary"]},
                error=None,
                requires_approval=True,
                approval_id=approval_id,
                pending_action=action,
            )

        # Safe apply (no risky)
        try:
            res = apply_plan(plan=plan, sandbox_root=sandbox_root, allow_risky=False)
            audit_tool_event(
                "file_organizer.apply.done",
                req.trace_id,
                req.session_id,
                {"result": res},
            )
            return ToolExecuteResponse(
                success=True,
                result={"mode": "apply", "summary": plan["summary"], "apply": res},
                error=None,
            )
        except Exception as e:
            audit_tool_event(
                "file_organizer.apply.error",
                req.trace_id,
                req.session_id,
                {"error": str(e)},
            )
            return ToolExecuteResponse(
                success=False, result={}, error=f"Apply failed: {e}"
            )

    # ---------------------------------------------------------
    # Existing approval gate for other tools
    # ---------------------------------------------------------
    needs, why = requires_user_approval(action)
    if needs:
        action_json = json.dumps(action, ensure_ascii=False, sort_keys=True)
        approval_id = create_pending(req.trace_id, req.session_id, action_json, why)

        audit_tool_event(
            "tool.approval.requested",
            req.trace_id,
            req.session_id,
            {
                "approval_id": approval_id,
                "reason": why,
                "action": action,
            },
        )

        return ToolExecuteResponse(
            success=False,
            result={},
            error=None,
            requires_approval=True,
            approval_id=approval_id,
            pending_action=action,
        )

    return _execute_action(req)


@app.post("/tool/approve", response_model=ToolExecuteResponse)
def tool_approve(req: ToolApproveRequest):
    approval_id = req.approval_id
    pending = get_pending(approval_id)
    if not pending:
        return ToolExecuteResponse(
            success=False, result={}, error="Unknown or expired approval_id"
        )

    trace_id = pending["trace_id"]
    session_id = pending["session_id"]
    action = pending["action"]

    if req.decision == "reject":
        audit_tool_event(
            "tool.approval.rejected",
            trace_id,
            session_id,
            {
                "approval_id": approval_id,
                "reason": req.reason or pending.get("reason") or "rejected",
                "action": action,
            },
        )
        delete_pending(approval_id)
        return ToolExecuteResponse(
            success=False, result={}, error="Action rejected by user"
        )

    # approve
    audit_tool_event(
        "tool.approval.approved",
        trace_id,
        session_id,
        {
            "approval_id": approval_id,
            "reason": req.reason or pending.get("reason") or "approved",
            "action": action,
        },
    )
    delete_pending(approval_id)

    # If approval is for file_organizer.run, apply with allow_risky=True
    kind = str(action.get("kind", "")).strip().lower()
    if kind == "file_organizer.run":
        schema_path = Path(str(action["schema_path"])).resolve()
        ruleset_path = Path(str(action["ruleset_path"])).resolve()
        sandbox_root = Path(str(action["sandbox_root"])).resolve()

        audit_tool_event(
            "file_organizer.approved.begin",
            trace_id,
            session_id,
            {"approval_id": approval_id},
        )

        plan = build_plan(
            schema_path=schema_path,
            ruleset_path=ruleset_path,
            sandbox_root=sandbox_root,
        )
        res = apply_plan(plan=plan, sandbox_root=sandbox_root, allow_risky=True)

        audit_tool_event(
            "file_organizer.approved.done",
            trace_id,
            session_id,
            {"summary": plan["summary"], "apply": res},
        )
        return ToolExecuteResponse(
            success=True,
            result={"mode": "apply", "summary": plan["summary"], "apply": res},
            error=None,
        )

    # Execute the approved action
    exec_req = ToolExecuteRequest(
        action=action, trace_id=trace_id, session_id=session_id
    )
    return _execute_action(exec_req)
