"""
Brain Operator Routes

FastAPI endpoints for:
- POST /brain/operator/execute — Execute an operator
- GET /brain/operator/list — List available operators
- POST /brain/operator/validate — Validate request
- GET /brain/operator/logs — Get execution logs
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uuid

from operators import (
    get_registry,
    MemoryContext,
)

router = APIRouter(prefix="/brain/operator", tags=["operator"])


# ============================================================================
# Pydantic Models (Request/Response)
# ============================================================================


class OperatorExecuteRequest(BaseModel):
    """Execute operator request."""

    operator_name: str
    payload: Dict[str, Any]
    memory_context: Optional[Dict[str, Any]] = None
    timeout_ms: int = Field(default=30000, ge=1000, le=60000)
    deterministic: bool = True


class OperatorExecuteResponse(BaseModel):
    """Execute operator response."""

    operator_id: str
    operator_name: str
    trace_id: str
    status: str
    result: Dict[str, Any]
    error: Optional[Dict[str, Any]] = None
    memory_writes: List[Dict[str, Any]]
    execution_time_ms: int
    deterministic_hash: Optional[str] = None


class OperatorListResponse(BaseModel):
    """List operators response."""

    operators: List[str]
    total: int


class OperatorValidateRequest(BaseModel):
    """Validate operator request."""

    operator_name: str
    payload: Dict[str, Any]


class OperatorValidateResponse(BaseModel):
    """Validate operator response."""

    valid: bool
    message: Optional[str] = None


# ============================================================================
# Routes
# ============================================================================


@router.post("/execute", response_model=OperatorExecuteResponse)
async def execute_operator(req: OperatorExecuteRequest) -> OperatorExecuteResponse:
    """Execute an operator with request payload."""

    operator_name = req.operator_name
    registry = get_registry()

    # Generate IDs
    operator_id = f"op_{uuid.uuid4().hex[:24]}"
    trace_id = f"{uuid.uuid4()}"

    # Build memory context
    memory_context = None
    if req.memory_context:
        memory_context = MemoryContext(
            facts=req.memory_context.get("facts", []),
            vectors=req.memory_context.get("vectors", []),
            summary=req.memory_context.get("summary", ""),
        )

    # Execute
    response = await registry.execute(
        operator_name=operator_name,
        trace_id=trace_id,
        payload=req.payload,
        memory_context=memory_context,
        timeout_ms=req.timeout_ms,
        deterministic=req.deterministic,
    )

    # Convert to response model
    return OperatorExecuteResponse(
        operator_id=operator_id,
        operator_name=response.operator_name,
        trace_id=response.trace_id,
        status=response.status,
        result=response.result,
        error=response.error,
        memory_writes=[
            {"key": w.key, "value": w.value, "ttl_seconds": w.ttl_seconds}
            for w in response.memory_writes
        ],
        execution_time_ms=response.execution_time_ms,
        deterministic_hash=response.deterministic_hash,
    )


@router.get("/list", response_model=OperatorListResponse)
async def list_operators() -> OperatorListResponse:
    """List all available operators."""
    registry = get_registry()
    operators = registry.list_operators()
    return OperatorListResponse(
        operators=operators,
        total=len(operators),
    )


@router.post("/validate", response_model=OperatorValidateResponse)
async def validate_operator(req: OperatorValidateRequest) -> OperatorValidateResponse:
    """Validate operator request."""
    registry = get_registry()
    valid, message = registry.validate_request(req.operator_name, req.payload)
    return OperatorValidateResponse(valid=valid, message=message)


@router.get("/logs")
async def get_operator_logs(limit: int = 100) -> Dict[str, Any]:
    """Get recent operator execution logs."""
    registry = get_registry()
    logs = registry.execution_log[-limit:]
    return {
        "total": len(registry.execution_log),
        "returned": len(logs),
        "logs": logs,
    }
