from __future__ import annotations

import dataclasses
import os
import sys
from typing import Any, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes_operator import router as operator_router
from routes_memory import router as memory_router
from routes_chat import router as chat_router
from app.routes.health import router as health_router
from leximorph import (
    LexiStore,
    ProvenanceRecord,
    build_registry,
    ingest_files,
)

app = FastAPI(title="World Engine Sidecar", version="0.0.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(operator_router)
app.include_router(memory_router)
app.include_router(chat_router)
app.include_router(health_router)


def _model_dump(model: BaseModel) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()  # type: ignore[no-any-return]
    return model.dict()  # type: ignore[no-any-return]


class LeximorphProvenanceModel(BaseModel):
    source_path: str | None = None
    source_kind: Literal["file", "text", "http"] = "text"
    workspace_root: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    col_start: int | None = None
    col_end: int | None = None
    snippet: str | None = None


class LeximorphAnalyzeRequest(BaseModel):
    text: str
    language: str = "en"
    kind: str = "word"
    store: bool = True
    provenance: LeximorphProvenanceModel | None = None
    tags: list[str] = Field(default_factory=list)
    force_review: bool = False
    source_type: Literal["manual", "batch", "ide", "api"] = "api"


class LeximorphQueryResponse(BaseModel):
    contains: str
    limit: int
    count: int
    results: list[dict[str, Any]]


class LeximorphSearchResponse(BaseModel):
    q: str
    limit: int
    count: int
    results: list[dict[str, Any]]


class LeximorphReviewRequest(BaseModel):
    action: Literal["approve", "reject", "note"]
    reason: str | None = None
    notes: str | None = None
    actor: str = "user"


class LeximorphIngestRequest(BaseModel):
    root_path: str
    include_globs: list[str] = Field(default_factory=list)
    exclude_globs: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=lambda: ["en", "js", "ts", "html"])
    max_files: int = 500
    max_file_bytes: int = 256 * 1024
    store: bool = True
    extract_words: bool = True
    extract_identifiers: bool = True
    extract_html: bool = True
    record_provenance: bool = True
    dry_run: bool = False
    requested_by: str = "api"


def _leximorph_store() -> LexiStore:
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "leximorph.sqlite"
    )
    store = LexiStore(db_path)
    store.init()
    return store


@app.post("/leximorph/init")
async def leximorph_init() -> dict[str, Any]:
    store = _leximorph_store()
    try:
        return {
            "ok": True,
            "db": store.db_path,
            "schema_version": store.schema_version(),
            "analyzer_version": store.analyzer_version(),
            "stats": store.stats(),
        }
    finally:
        store.close()


@app.get("/leximorph/health")
async def leximorph_health() -> dict[str, Any]:
    store = _leximorph_store()
    try:
        return {
            "ok": True,
            "service": "leximorph",
            "db": store.db_path,
            "schema_version": store.schema_version(),
            "analyzer_version": store.analyzer_version(),
            "counts": store.stats(),
        }
    finally:
        store.close()


@app.post("/leximorph/analyze")
async def leximorph_analyze(req: LeximorphAnalyzeRequest) -> dict[str, Any]:
    registry = build_registry()
    analyzed = registry.analyze(text=req.text, language=req.language, kind=req.kind)
    analyzed_payload = dataclasses.asdict(analyzed)

    stored_id: Optional[int] = None
    status: Optional[str] = None
    review_required = bool(analyzed.meta.get("review_required", False))

    store = _leximorph_store()
    try:
        if req.store:
            prov = None
            if req.provenance:
                p = _model_dump(req.provenance)
                p["ingest_mode"] = "on_demand"
                prov = ProvenanceRecord(**p)
            stored_id = store.insert(
                analyzed,
                prov,
                source_type=req.source_type,
                force_review=req.force_review,
                tags=req.tags,
            )
            detail = store.get_entry_detail(stored_id)
            if detail:
                status = str(detail.get("status"))
                review_required = bool(
                    detail.get("meta", {}).get("review_required", review_required)
                )

        return {
            **analyzed_payload,
            "stored": bool(req.store),
            "id": stored_id,
            "status": status,
            "review_required": review_required,
            "schema_version": store.schema_version(),
        }
    finally:
        store.close()


@app.get("/leximorph/query")
async def leximorph_query(
    contains: str = "",
    limit: int = 50,
    language: str | None = None,
    kind: str | None = None,
    status: str | None = None,
    part_type: str | None = None,
) -> LeximorphQueryResponse:
    bounded_limit = max(1, min(500, int(limit)))
    store = _leximorph_store()
    try:
        rows = store.query_contains(
            contains,
            limit=bounded_limit,
            language=language,
            kind=kind,
            status=status,
            part_type=part_type,
        )
    finally:
        store.close()

    return LeximorphQueryResponse(
        contains=contains, limit=bounded_limit, count=len(rows), results=rows
    )


@app.get("/leximorph/search")
async def leximorph_search(
    q: str,
    limit: int = 25,
    language: str | None = None,
    kind: str | None = None,
    status: str | None = None,
    part_type: str | None = None,
    include_provenance: bool = False,
    include_parts: bool = True,
) -> LeximorphSearchResponse:
    bounded_limit = max(1, min(200, int(limit)))
    store = _leximorph_store()
    try:
        rows = store.search(
            q,
            limit=bounded_limit,
            language=language,
            kind=kind,
            status=status,
            part_type=part_type,
            include_provenance=include_provenance,
            include_parts=include_parts,
        )
    finally:
        store.close()
    return LeximorphSearchResponse(
        q=q, limit=bounded_limit, count=len(rows), results=rows
    )


@app.get("/leximorph/entry/{entry_id}")
async def leximorph_entry(entry_id: int) -> dict[str, Any]:
    store = _leximorph_store()
    try:
        detail = store.get_entry_detail(entry_id)
        if detail is None:
            raise HTTPException(status_code=404, detail="entry_not_found")
        return detail
    finally:
        store.close()


@app.get("/leximorph/review-queue")
async def leximorph_review_queue(
    limit: int = 50,
    language: str | None = None,
    kind: str | None = None,
    min_confidence: float | None = None,
    status: str = "needs_review",
) -> dict[str, Any]:
    bounded_limit = max(1, min(500, int(limit)))
    store = _leximorph_store()
    try:
        rows = store.list_review_queue(
            language=language,
            kind=kind,
            limit=bounded_limit,
            min_confidence=min_confidence,
            status=status,
        )
        return {"ok": True, "count": len(rows), "limit": bounded_limit, "results": rows}
    finally:
        store.close()


@app.post("/leximorph/review/{entry_id}")
async def leximorph_review(
    entry_id: int, req: LeximorphReviewRequest
) -> dict[str, Any]:
    store = _leximorph_store()
    try:
        detail = store.review_entry(
            entry_id,
            action=req.action,
            actor=req.actor,
            reason=req.reason,
            notes=req.notes,
        )
        if detail is None:
            raise HTTPException(status_code=404, detail="entry_not_found")
        return {"ok": True, "entry": detail}
    finally:
        store.close()


@app.post("/leximorph/ingest/files")
async def leximorph_ingest_files(req: LeximorphIngestRequest) -> dict[str, Any]:
    registry = build_registry()
    store = _leximorph_store()
    try:
        return ingest_files(
            store=store,
            registry=registry,
            root_path=req.root_path,
            include_globs=req.include_globs or None,
            exclude_globs=req.exclude_globs or None,
            languages=req.languages or None,
            max_files=req.max_files,
            max_file_bytes=req.max_file_bytes,
            store_results=req.store,
            extract_words=req.extract_words,
            extract_identifiers=req.extract_identifiers,
            extract_html=req.extract_html,
            record_provenance=req.record_provenance,
            dry_run=req.dry_run,
            requested_by=req.requested_by,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        store.close()


@app.get("/leximorph/ingest/runs/{run_id}")
async def leximorph_ingest_run(run_id: str) -> dict[str, Any]:
    store = _leximorph_store()
    try:
        run = store.get_ingest_run(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="ingest_run_not_found")
        return run
    finally:
        store.close()
