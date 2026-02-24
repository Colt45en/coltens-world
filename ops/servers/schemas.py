from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


EnvelopeV = Literal["1.0"]

class Envelope(BaseModel):
    v: EnvelopeV = "1.0"
    id: str
    ts: str
    traceId: str
    source: str
    kind: str
    payload: Dict[str, Any]

class ChatRequestPayload(BaseModel):
    convoId: str
    userId: str
    persona: str
    text: str

class ToolCall(BaseModel):
    name: str
    args: Dict[str, Any] = Field(default_factory=dict)

class ChatResponsePayload(BaseModel):
    convoId: str
    text: str
    evidence: Optional[Dict[str, Any]] = None
    toolCalls: List[ToolCall] = Field(default_factory=list)

# Tool server request
class ToolExecuteRequest(BaseModel):
    action: Dict[str, Any]
    trace_id: str
    session_id: str

class ToolExecuteResponse(BaseModel):
    success: bool
    result: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None

    # NEW (approval flow)
    requires_approval: bool = False
    approval_id: Optional[str] = None
    pending_action: Optional[Dict[str, Any]] = None


class ToolApproveRequest(BaseModel):
    approval_id: str
    decision: Literal["approve", "reject"]
    reason: Optional[str] = None
