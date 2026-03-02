from __future__ import annotations

import asyncio
import time
from typing import AsyncGenerator, Dict, Any, Optional, List

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


router = APIRouter(tags=["chat"])


# ============================================================================
# Contracts (match Nucleus ChatHandler expectations)
# ============================================================================


class ChatRequest(BaseModel):
    traceId: str = Field(..., min_length=2)
    convoId: str = "default"
    userId: str = "anonymous"
    persona: str = "assistant"
    text: str = Field(..., min_length=1)
    recentHistory: List[Dict[str, Any]] = Field(default_factory=list)
    context: Optional[Dict[str, Any]] = None


class StreamEvent(BaseModel):
    type: str
    data: Dict[str, Any]


# ============================================================================
# Service hook (upgrade later with real LLM, tools, memory, lexicon)
# ============================================================================


async def run_reasoning(req: ChatRequest) -> Dict[str, Any]:
    """
    Deterministic baseline reasoning — runs immediately, no LLM yet.

    Replace this with:
      - real LLM call (Claude, etc.)
      - operator tool routing
      - lexicon + memory integration
      - deterministic prompt + seeded RNG
    """
    # Minimal response that is stable and testable
    text = (
        f"traceId={req.traceId}\n"
        f"persona={req.persona}\n"
        f"convoId={req.convoId}\n"
        f"userId={req.userId}\n\n"
        f"You said:\n{req.text}\n\n"
        f"Tip: Prefix with 'patch:' to route to PatchOperator (handled in Nucleus)."
    )

    # Return structured outputs (empty for now, ready for expansion)
    return {
        "text": text,
        "tool_calls": [],
        "citations": [],
        "memory_writes": [],
        "stop_reason": "end_turn",
    }


# ============================================================================
# /chat/stream — NDJSON streaming endpoint
# ============================================================================


@router.post("/chat/stream", response_class=StreamingResponse)
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    """
    Stream ChatResponse events line-by-line (NDJSON).

    Nucleus ChatHandler reads resp.body line-by-line and JSON.parses() each line.
    This matches exactly.

    Events:
    - { type: "start", data: { traceId: "...", ts: ... } }
    - { type: "text_chunk", data: { traceId: "...", seq: N, text: "..." } }
    - { type: "tool_call", data: { traceId: "...", seq: N, tool: {...} } }
    - { type: "citation", data: { traceId: "...", seq: N, citation: {...} } }
    - { type: "memory_write", data: { traceId: "...", seq: N, write: {...} } }
    - { type: "done", data: { traceId: "...", seq: N, stop_reason: "...", latency_ms: N } }
    - { type: "error", data: { traceId: "...", message: "..." } }
    """

    async def generate() -> AsyncGenerator[bytes, None]:
        started = time.time()
        seq = 0

        try:
            # Immediate ack event
            ack = StreamEvent(
                type="start", data={"traceId": req.traceId, "ts": time.time()}
            )
            yield (ack.model_dump_json() + "\n").encode("utf-8")
            seq += 1

            # Run reasoning
            result = await run_reasoning(req)
            text = str(result.get("text", ""))

            # Stream text in chunks (16 chars per chunk for readable tokens)
            CHUNK = 16
            for i in range(0, len(text), CHUNK):
                chunk = text[i : i + CHUNK]
                ev = StreamEvent(
                    type="text_chunk",
                    data={
                        "traceId": req.traceId,
                        "seq": seq,
                        "text": chunk,
                    },
                )
                yield (ev.model_dump_json() + "\n").encode("utf-8")
                seq += 1
                await asyncio.sleep(0)  # cooperative yield

            # Stream tool_calls / citations / memory_writes (if any)
            for tc in result.get("tool_calls", []) or []:
                ev = StreamEvent(
                    type="tool_call",
                    data={
                        "traceId": req.traceId,
                        "seq": seq,
                        "tool": tc,
                    },
                )
                yield (ev.model_dump_json() + "\n").encode("utf-8")
                seq += 1

            for c in result.get("citations", []) or []:
                ev = StreamEvent(
                    type="citation",
                    data={
                        "traceId": req.traceId,
                        "seq": seq,
                        "citation": c,
                    },
                )
                yield (ev.model_dump_json() + "\n").encode("utf-8")
                seq += 1

            for mw in result.get("memory_writes", []) or []:
                ev = StreamEvent(
                    type="memory_write",
                    data={
                        "traceId": req.traceId,
                        "seq": seq,
                        "write": mw,
                    },
                )
                yield (ev.model_dump_json() + "\n").encode("utf-8")
                seq += 1

            # Final done event
            latency_ms = int((time.time() - started) * 1000)
            done = StreamEvent(
                type="done",
                data={
                    "traceId": req.traceId,
                    "seq": seq,
                    "stop_reason": result.get("stop_reason", "end_turn"),
                    "latency_ms": latency_ms,
                },
            )
            yield (done.model_dump_json() + "\n").encode("utf-8")

        except Exception as e:
            err = StreamEvent(
                type="error", data={"traceId": req.traceId, "message": str(e)}
            )
            yield (err.model_dump_json() + "\n").encode("utf-8")

    return StreamingResponse(generate(), media_type="application/x-ndjson")
