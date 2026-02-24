"""
Brain Memory Routes

FastAPI endpoints for:
- GET /brain/memory/facts — List facts
- GET /brain/memory/vectors — List vectors
- GET /brain/memory/summaries — List summaries
- GET /brain/memory/fact/{key} — Get single fact
- POST /brain/memory/fact — Write fact
- GET /brain/memory/stats — Memory service stats
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import asyncio
import aiohttp
from datetime import datetime
import logging

from memory import (
    get_memory_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/brain/memory", tags=["memory"])


# ============================================================================
# Memory Bus Publishing (Session 10: Event-driven UX)
# ============================================================================

async def emit_memory_event(
    event_type: str,
    key: str,
    value: Any,
    nucleus_url: str = "http://localhost:3000",
) -> bool:
    """
    Emit memory event to bus for live IDE panel updates.

    Event types:
    - memory.fact.updated: fact was written/updated
    - memory.vector.updated: vector embedding added
    - memory.summary.updated: working summary changed

    Returns:
        True if emission succeeded, False otherwise
    """
    try:
        event = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "payload": {
                "key": key,
                "value": value,
            },
        }

        # Try to POST to Nucleus bus endpoint
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{nucleus_url}/bus/event",
                json=event,
                timeout=aiohttp.ClientTimeout(total=2),
            ) as resp:
                if resp.status in [200, 202]:
                    logger.debug(f"[memory] emitted {event_type} for key={key}")
                    return True
                else:
                    logger.warning(f"[memory] emit failed: {event_type} status={resp.status}")
                    return False

    except Exception as e:
        # Log but don't fail -- bus emission is informational
        logger.warning(f"[memory] Bus emission failed: {str(e)}")
        return False


# ============================================================================
# Pydantic Models
# ============================================================================


class MemoryFactRequest(BaseModel):
    """Write fact request."""

    key: str = Field(..., min_length=1)
    value: str
    ttl_seconds: Optional[int] = None


class MemoryVectorRequest(BaseModel):
    """Write vector request."""

    key: str = Field(..., min_length=1)
    vector: List[float]
    label: Optional[str] = ""
    ttl_seconds: Optional[int] = 604800  # 1 week


class MemorySummaryRequest(BaseModel):
    """Write summary request."""

    key: str = Field(..., min_length=1)
    summary: str
    ttl_seconds: Optional[int] = None


class MemoryFactResponse(BaseModel):
    """Fact entry response."""

    key: str
    value: str
    created_at: str
    ttl_seconds: Optional[int]
    expires_at: Optional[str]
    is_expired: bool


class MemoryStatsResponse(BaseModel):
    """Memory service stats."""

    uptime_seconds: float
    fact_count: int
    vector_count: int
    summary_count: int
    total_entries: int
    recent_cleanup: Dict[str, int]


# ============================================================================
# Routes
# ============================================================================


@router.get("/fact/{key}")
async def get_fact(key: str) -> Dict[str, Any]:
    """Get single fact by key."""
    service = get_memory_service()
    value = service.get_fact(key)

    if value is None:
        raise HTTPException(status_code=404, detail=f"Fact '{key}' not found or expired")

    return {"key": key, "value": value, "ok": True}


@router.post("/fact")
async def write_fact(req: MemoryFactRequest) -> Dict[str, Any]:
    """Write or update a fact (emits memory.fact.updated event to IDE)."""
    service = get_memory_service()
    service.write_fact(req.key, req.value, req.ttl_seconds)

    # Emit event for live IDE panel updates (fire-and-forget)
    asyncio.create_task(
        emit_memory_event(
            event_type="memory.fact.updated",
            key=req.key,
            value=req.value,
        )
    )

    return {"ok": True, "key": req.key}


@router.get("/facts")
async def list_facts(prefix: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
    """List all facts (optionally filtered by prefix)."""
    service = get_memory_service()
    facts = service.list_facts(prefix, limit)

    return {
        "ok": True,
        "total": len(service.facts),
        "returned": len(facts),
        "facts": facts,
    }


@router.post("/vector")
async def write_vector(req: MemoryVectorRequest) -> Dict[str, Any]:
    """Write or update a vector embedding (emits memory.vector.updated event)."""
    service = get_memory_service()
    service.write_vector(req.key, req.vector, req.label, req.ttl_seconds)

    # Emit event for live IDE
    asyncio.create_task(
        emit_memory_event(
            event_type="memory.vector.updated",
            key=req.key,
            value={"label": req.label, "dim": len(req.vector)},
        )
    )

    return {"ok": True, "key": req.key}


@router.get("/vectors")
async def list_vectors(limit: int = 100) -> Dict[str, Any]:
    """List all vectors."""
    service = get_memory_service()
    vectors = service.list_vectors(limit)

    return {
        "ok": True,
        "total": len(service.vectors),
        "returned": len(vectors),
        "vectors": vectors,
    }


@router.post("/summary")
async def write_summary(req: MemorySummaryRequest) -> Dict[str, Any]:
    """Write or update a working summary (emits memory.summary.updated event)."""
    service = get_memory_service()
    service.write_summary(req.key, req.summary, req.ttl_seconds)

    # Emit event for live IDE
    asyncio.create_task(
        emit_memory_event(
            event_type="memory.summary.updated",
            key=req.key,
            value=req.summary,
        )
    )

    return {"ok": True, "key": req.key}


@router.get("/summaries")
async def list_summaries(limit: int = 100) -> Dict[str, Any]:
    """List all summaries."""
    service = get_memory_service()
    summaries = service.list_summaries(limit)

    return {
        "ok": True,
        "total": len(service.summaries),
        "returned": len(summaries),
        "summaries": summaries,
    }


@router.get("/stats", response_model=MemoryStatsResponse)
async def get_stats() -> MemoryStatsResponse:
    """Get memory service statistics."""
    service = get_memory_service()
    stats = service.stats()

    return MemoryStatsResponse(**stats)


@router.delete("/fact/{key}")
async def delete_fact(key: str) -> Dict[str, Any]:
    """Delete a fact."""
    service = get_memory_service()
    success = service.delete_fact(key)

    if not success:
        raise HTTPException(status_code=404, detail=f"Fact '{key}' not found")

    return {"ok": True, "key": key}


@router.post("/cleanup")
async def cleanup_expired() -> Dict[str, Any]:
    """Remove expired entries."""
    service = get_memory_service()
    removed = service.cleanup_expired()

    return {"ok": True, "removed": removed}
