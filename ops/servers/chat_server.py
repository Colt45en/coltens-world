# ops/servers/chat_server.py
from __future__ import annotations

import asyncio
import time
import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from .schemas import Envelope, ChatRequestPayload, ChatResponsePayload, ToolCall
from .ollama_client import ollama_chat_json, OllamaError

app = FastAPI(title="World Engine Chat Server", version="1.1")

DEFAULT_MODEL = "llama3.2:1b"  # Ollama model name
MAX_HISTORY = 30            # keep it bounded

SYSTEM_PROMPT = """You are the World Engine chat agent.

You MUST respond as STRICT JSON with this schema:
{
  "text": "assistant response text",
  "toolCalls": [
    { "name": "computer", "args": { "action": "screenshot" } },
    { "name": "computer", "args": { "action": "left_click", "coordinate": [100, 200] } },
    { "name": "computer", "args": { "action": "type", "text": "hello" } },
    { "name": "computer", "args": { "action": "key", "key": "ctrl+l" } },
    { "name": "computer", "args": { "action": "scroll", "scroll_direction": "down", "scroll_amount": 3 } }
  ],
  "evidence": {
    "actions": [
      { "name": "computer", "args": { "action": "screenshot" }, "argsPreview": "{}", "confidence": 0.8 }
    ]
  }
}

Rules:
- Only include toolCalls when needed.
- Prefer taking a screenshot before clicks if unsure.
- Keep toolCalls minimal (one step at a time is best).
- Never attempt login, payments, or destructive actions.
- If you need more context, request agent_screenshot first.
"""

# In-memory convo history: {convoId: [{"role":"system|user|assistant","content":...}, ...]}
HIST: Dict[str, List[Dict[str, str]]] = {}

@app.get("/health")
def health():
    return {"ok": True, "ts": time.time()}


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def uid(prefix="env") -> str:
    return f"{prefix}-{int(time.time() * 1000)}-{hex(int(time.time() * 1000000))[-6:]}"


async def ws_send(ws: WebSocket, trace_id: str, kind: str, payload: Dict[str, Any]):
    msg = Envelope(
        id=uid(),
        ts=iso_now(),
        traceId=trace_id,
        source="world-engine-core",
        kind=kind,
        payload=payload,
    )
    await ws.send_json(msg.model_dump())


def _get_convo(convo_id: str) -> List[Dict[str, str]]:
    if convo_id not in HIST:
        HIST[convo_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    return HIST[convo_id]


def _trim_history(convo: List[Dict[str, str]]) -> List[Dict[str, str]]:
    # Keep system + last MAX_HISTORY turns
    if not convo:
        return convo
    sys0 = convo[0:1]
    tail = convo[1:]
    if len(tail) <= MAX_HISTORY:
        return convo
    return sys0 + tail[-MAX_HISTORY:]


def _chunk_text(s: str, n: int = 40) -> List[str]:
    return [s[i : i + n] for i in range(0, len(s), n)] or [""]


def _safe_toolcalls(raw: Any) -> List[ToolCall]:
    out: List[ToolCall] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        args = item.get("args", {})
        if not name:
            continue
        if not isinstance(args, dict):
            args = {}
        # Only allow tools with your UI convention:
        if not name.startswith("agent_"):
            continue
        out.append(ToolCall(name=name, args=args))
    return out


@app.websocket("/ws/chat")
async def ws_chat(ws: WebSocket):
    await ws.accept()
    trace_id = "unknown"

    try:
        while True:
            data = await ws.receive_json()
            env = Envelope.model_validate(data)
            trace_id = env.traceId

            if env.kind == "chat.request":
                req = ChatRequestPayload.model_validate(env.payload)
                convo_id = req.convoId
                convo = _get_convo(convo_id)

                # Add user message to convo history
                convo.append({"role": "user", "content": req.text})
                HIST[convo_id] = _trim_history(convo)

                # Start streaming
                await ws_send(ws, trace_id, "chat.start", {"convoId": convo_id})

                # Call Ollama
                try:
                    out_json = ollama_chat_json(
                        model=DEFAULT_MODEL,
                        messages=HIST[convo_id],
                        temperature=0.2,
                    )
                except OllamaError as e:
                    err_text = f"Ollama error: {e}"
                    for ch in _chunk_text(err_text, 40):
                        await ws_send(ws, trace_id, "chat.delta", {"convoId": convo_id, "delta": ch})
                        await asyncio.sleep(0.01)

                    resp = ChatResponsePayload(convoId=convo_id, text=err_text, toolCalls=[])
                    await ws_send(ws, trace_id, "chat.response", resp.model_dump())
                    convo.append({"role": "assistant", "content": err_text})
                    HIST[convo_id] = _trim_history(convo)
                    continue

                # Parse result schema
                text = str(out_json.get("text", "")).strip()
                tool_calls = _safe_toolcalls(out_json.get("toolCalls", []))
                evidence = out_json.get("evidence")

                # Stream text
                for ch in _chunk_text(text, 40):
                    await ws_send(ws, trace_id, "chat.delta", {"convoId": convo_id, "delta": ch})
                    await asyncio.sleep(0.01)

                # Respond with tool calls
                resp = ChatResponsePayload(convoId=convo_id, text=text, evidence=evidence, toolCalls=tool_calls)
                await ws_send(ws, trace_id, "chat.response", resp.model_dump())

                # Store assistant message in history (we store full JSON as assistant content to preserve tool intent)
                convo.append({"role": "assistant", "content": json.dumps(out_json, ensure_ascii=False)})
                HIST[convo_id] = _trim_history(convo)

            elif env.kind == "tool.result":
                # UI sends tool results here; forward them back so UI can render as messages too.
                # Payload schema is whatever your UI sends (it already sends toolName/ok/result/error).
                await ws_send(ws, trace_id, "tool.result", env.payload)

            else:
                # Ignore unknown kinds for now
                pass

    except WebSocketDisconnect:
        return
