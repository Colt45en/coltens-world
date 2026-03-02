"""
Brain — FastAPI streaming chat service with NDJSON protocol.

Endpoints:
  POST /chat/stream — yields chat.delta.v1, chat.tool_call.v1, chat.done.v1
  POST /lexicon/query — searches lexicon by term
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Optional

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from lexicon_service import query_lexicon


class ChatRequest(BaseModel):
    convoId: str
    messageId: str
    prompt: str
    stream: bool = True
    tools: Optional[list[dict]] = None


def ndjson(obj: dict[str, Any]) -> str:
    """Serialize dict to NDJSON line (JSON + newline)."""
    return json.dumps(obj, ensure_ascii=False) + "\n"


async def simulate_llm_stream(
    prompt: str, tools: Optional[list[dict]] = None
) -> AsyncIterator[dict[str, Any]]:
    """
    Replace this with real LLM streaming (OpenRouter, Claude, etc.).

    This demo:
    - yields delta tokens
    - optionally yields a tool call
    - yields done
    """
    # Simulated response text
    text = (
        f"Thinking about: {prompt}. Here is a streamed answer with relevant insights. "
    )

    # Stream tokens with small delays
    for word in text.split():
        yield {"kind": "delta", "text_delta": word + " "}
        await asyncio.sleep(0.02)  # simulate token latency

    # Example tool call (if tools were provided)
    if tools and "lexicon" in prompt.lower():
        yield {
            "kind": "tool_call",
            "name": "query_lexicon",
            "arguments": {"term": "entropy", "context": prompt},
        }

    # Always end with done
    yield {"kind": "done", "stop_reason": "end_turn"}


app = FastAPI(title="Brain", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/lexicon/query")
async def lexicon_query_endpoint(query: dict[str, Any]):
    """
    Query the lexicon for a term.

    Request body:
      { "term": "entropy", "k": 5 }
    """
    term = query.get("term", "")
    k = int(query.get("k", 5))
    return query_lexicon(term, k)


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    Stream chat response as NDJSON.

    Each line is one of:
      - chat.delta.v1        (text token)
      - chat.tool_call.v1    (tool invocation)
      - chat.done.v1         (end of stream)

    Returns StreamingResponse with media_type="application/x-ndjson"
    """

    async def generate():
        # Derive stable IDs from request
        trace_id = f"tr-{req.convoId}-{req.messageId}"
        msg_id = req.messageId

        try:
            # Stream from LLM simulator (replace with real LLM later)
            async for chunk in simulate_llm_stream(req.prompt, tools=req.tools):
                kind = chunk.get("kind")

                if kind == "delta":
                    yield ndjson(
                        {
                            "type": "chat.delta.v1",
                            "traceId": trace_id,
                            "messageId": msg_id,
                            "payload": {"text_delta": chunk["text_delta"]},
                        }
                    )

                elif kind == "tool_call":
                    yield ndjson(
                        {
                            "type": "chat.tool_call.v1",
                            "traceId": trace_id,
                            "messageId": msg_id,
                            "payload": {
                                "name": chunk["name"],
                                "arguments": chunk["arguments"],
                            },
                        }
                    )

                elif kind == "done":
                    yield ndjson(
                        {
                            "type": "chat.done.v1",
                            "traceId": trace_id,
                            "messageId": msg_id,
                            "payload": {
                                "stop_reason": chunk.get("stop_reason", "end_turn")
                            },
                        }
                    )

        except Exception as e:
            # Emit error as final frame (optional)
            yield ndjson(
                {
                    "type": "chat.error.v1",
                    "traceId": trace_id,
                    "messageId": msg_id,
                    "payload": {"error": str(e)},
                }
            )

    return StreamingResponse(generate(), media_type="application/x-ndjson")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
