"""
Brain Service - Agentic Reasoning + Orchestration

Receives ChatRequest from Nucleus, runs planning, generates ToolCalls,
returns ChatResponse (with citations + memory writes).

Handles:
- Context assembly (history + world state + lexicon)
- Deterministic reasoning (no hallucination)
- Tool routing (UI local vs server routed)
- Streaming token-by-token
"""

import asyncio
import json
import time
from datetime import datetime
from typing import List, Literal, Optional
from uuid import uuid4

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Brain", version="1.0.0")


# ============================================================================
# Schemas (match @world-engine/protocol)
# ============================================================================


class ToolCall(BaseModel):
    name: str
    args: dict = Field(default_factory=dict)
    timeout: int = 5000
    critical: bool = False


class Citation(BaseModel):
    url: str
    title: str
    snippet: Optional[str] = None


class MemoryWrite(BaseModel):
    key: str
    value: str
    ttl: Optional[int] = None  # seconds; None = permanent


class ChatRequest(BaseModel):
    traceId: str
    convoId: str
    userId: str
    text: str
    persona: str = "assistant"
    recentHistory: List[dict] = Field(default_factory=list)
    context: Optional[dict] = None  # { mapId, playerPos, visibleEntities, ... }


class ChatResponse(BaseModel):
    traceId: str
    convoId: str
    text: str
    toolCalls: List[ToolCall] = Field(default_factory=list)
    toolResults: List[dict] = Field(default_factory=list)
    citations: List[Citation] = Field(default_factory=list)
    memoryWrites: List[MemoryWrite] = Field(default_factory=list)
    stop_reason: str = "end_turn"


class StreamEvent(BaseModel):
    """
    Streaming event contract (mirrors TypeScript packages/protocol/src/chatStream.ts)

    v:       Schema version (always "1.0")
    traceId: Request correlation ID
    turnId:  User turn ID (unique per chat)
    seq:     Monotonic counter (0-based)
    type:    Event type discriminator
    data:    Type-specific payload
    ts:      Server-side timestamp (ms)
    """
    v: Literal["1.0"] = "1.0"
    traceId: str = Field(..., min_length=1, max_length=256)
    turnId: str = Field(..., min_length=1, max_length=256)
    seq: int = Field(...)  # Set by caller
    type: Literal[
        "text_chunk", "tool_call", "tool_result",
        "citation", "memory_write", "done", "error"
    ]
    data: dict = Field(default_factory=dict)
    ts: Optional[int] = Field(default=None)  # Will be set if None


# ============================================================================
# Lexicon Stub (soon will call real service)
# ============================================================================


async def query_lexicon(q: str, limit: int = 5) -> List[dict]:
    """
    Query lexicon for semantic hits.
    TODO: Replace with HTTP call to real Lexicon service.
    """
    # Stub: return placeholder entries
    return [
        {
            "id": f"lex_{i}",
            "kind": "concept",
            "label": f"Concept: {q}",
            "description": f"Mock lexicon entry for '{q}'",
        }
        for i in range(min(limit, 3))
    ]


# ============================================================================
# Planning Engine (deterministic, rule-based MVP)
# ============================================================================


async def run_reasoning(
    req: ChatRequest,
) -> tuple[str, List[ToolCall], List[Citation], List[MemoryWrite]]:
    """
    Deterministic reasoning step.

    For MVP: simple rules. Later: LLM call, but with deterministic prompt + seeded RNG.

    Returns: (response_text, toolCalls, citations, memoryWrites)
    """

    user_text = req.text.lower()
    citations = []
    tool_calls = []
    memory_writes = []

    # Example: if user asks about map, query lexicon
    if "map" in user_text or "location" in user_text:
        lex_entries = await query_lexicon(req.text, limit=3)
        for entry in lex_entries:
            citations.append(
                Citation(
                    url=f"lexicon://{entry['id']}",
                    title=entry["label"],
                    snippet=entry["description"],
                )
            )
        response = (
            f"I found {len(lex_entries)} relevant entries. "
            f"Current context: {req.context or 'none provided'}."
        )
    # Example: if user gives a command, generate tool call
    elif "record" in user_text or "screenshot" in user_text:
        tool_calls.append(
            ToolCall(name="record_screen", args={"duration": 10}, critical=False)
        )
        response = "I'll record your screen for the next 10 seconds."
    # Default
    else:
        response = f"Processing: {req.text[:50]}... (Brain MVP, no LLM yet)"

    # Example memory write (store a fact)
    memory_writes.append(MemoryWrite(key=f"last_query_{req.userId}", value=user_text))

    return response, tool_calls, citations, memory_writes


# ============================================================================
# Endpoints
# ============================================================================


@app.post("/health")
async def health():
    """Health check."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/chat/stream", response_class=StreamingResponse)
async def chat_stream(req: ChatRequest):
    """Stream ChatResponse events as NDJSON with tracing + ordering."""

    async def generate():
        try:
            # Extract trace context
            traceId = req.traceId
            turnId = getattr(req, "turnId", f"turn_{uuid4()}")

            seq = 0  # Monotonic counter

            # Run planning
            text, tool_calls, citations, memory_writes = await run_reasoning(req)

            # Stream text in chunks
            for i in range(0, len(text), 10):
                chunk = text[i : i + 10]
                event = StreamEvent(
                    v="1.0",
                    traceId=traceId,
                    turnId=turnId,
                    seq=seq,
                    type="text_chunk",
                    data={"text": chunk},
                    ts=int(time.time() * 1000),
                )
                seq += 1
                yield json.dumps(event.model_dump()) + "\n"
                await asyncio.sleep(0.01)

            # Stream tool calls
            for idx, tc in enumerate(tool_calls):
                event = StreamEvent(
                    v="1.0",
                    traceId=traceId,
                    turnId=turnId,
                    seq=seq,
                    type="tool_call",
                    data={
                        "callId": f"call_{traceId}_{idx}",  # P0.5: unique per call
                        "name": tc.name,
                        "args": tc.args or {},
                        "timeoutMs": tc.timeout,
                        "critical": tc.critical,
                    },
                    ts=int(time.time() * 1000),
                )
                seq += 1
                yield json.dumps(event.model_dump()) + "\n"

            # Stream citations
            for cit in citations:
                event = StreamEvent(
                    v="1.0",
                    traceId=traceId,
                    turnId=turnId,
                    seq=seq,
                    type="citation",
                    data={
                        "type": cit.url.split("://")[0],  # Extract type from URL scheme
                        "ref": cit.url,
                        "text": cit.snippet or cit.title,
                    },
                    ts=int(time.time() * 1000),
                )
                seq += 1
                yield json.dumps(event.model_dump()) + "\n"

            # Stream memory writes
            for mw in memory_writes:
                event = StreamEvent(
                    v="1.0",
                    traceId=traceId,
                    turnId=turnId,
                    seq=seq,
                    type="memory_write",
                    data={
                        "key": mw.key,
                        "value": mw.value,
                        "ttl": mw.ttl,
                    },
                    ts=int(time.time() * 1000),
                )
                seq += 1
                yield json.dumps(event.model_dump()) + "\n"

            # Done
            event = StreamEvent(
                v="1.0",
                traceId=traceId,
                turnId=turnId,
                seq=seq,
                type="done",
                data={"stop_reason": "end_turn"},
                ts=int(time.time() * 1000),
            )
            yield json.dumps(event.model_dump()) + "\n"

        except Exception as e:
            import traceback
            error_event = StreamEvent(
                v="1.0",
                traceId=req.traceId,
                turnId=getattr(req, "turnId", f"turn_{uuid4()}"),
                seq=0,
                type="error",
                data={"error": str(e), "code": "internal"},
                ts=int(time.time() * 1000),
            )
            yield json.dumps(error_event.model_dump()) + "\n"
            traceback.print_exc()

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/chat", response_model=ChatResponse)
async def chat_full(req: ChatRequest):
    """
    Non-streaming endpoint (for testing or simple clients).
    """
    text, tool_calls, citations, memory_writes = await run_reasoning(req)
    return ChatResponse(
        traceId=req.traceId,
        convoId=req.convoId,
        text=text,
        toolCalls=tool_calls,
        citations=citations,
        memoryWrites=memory_writes,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
