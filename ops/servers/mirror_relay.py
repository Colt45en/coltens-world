import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Body
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from psycopg_pool import AsyncConnectionPool

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/keeper"
)

app = FastAPI()

# If your UI is on another origin, keep this. Tighten allowed origins in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pool = AsyncConnectionPool(conninfo=DATABASE_URL, min_size=1, max_size=10, timeout=10)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize(env: Dict[str, Any]) -> Dict[str, Any]:
    # Accept legacy envelope: { v, kind, payload, ts, id, source }
    if "kind" in env and "payload" in env:
        return {
            "id": env.get("id") or str(uuid.uuid4()),
            "topic": env.get("kind"),
            "category": env.get("source") or "ws",
            "timestamp": env.get("ts") or iso_now(),
            "data": env.get("payload") or {},
        }
    # Canonical envelope
    return {
        "id": env.get("id") or env.get("event_id") or str(uuid.uuid4()),
        "topic": env.get("topic") or env.get("type") or env.get("kind") or "unknown",
        "category": env.get("category") or env.get("source"),
        "timestamp": env.get("timestamp") or env.get("ts") or iso_now(),
        "data": env.get("data") or env.get("payload") or {},
    }


def topic_match(topic: str, patterns: Set[str]) -> bool:
    if not patterns:
        return True
    for p in patterns:
        p = p.strip()
        if not p:
            continue
        if p.endswith(".*") and topic.startswith(p[:-2]):
            return True
        if topic == p:
            return True
    return False


class Hub:
    def __init__(self):
        self.ws_clients: Dict[WebSocket, Set[str]] = {}
        self.sse_queues: List[asyncio.Queue[str]] = []
        self.lock = asyncio.Lock()

    async def register_ws(self, ws: WebSocket):
        async with self.lock:
            self.ws_clients[ws] = set()

    async def unregister_ws(self, ws: WebSocket):
        async with self.lock:
            self.ws_clients.pop(ws, None)

    async def set_ws_topics(self, ws: WebSocket, topics: List[str]):
        async with self.lock:
            if ws in self.ws_clients:
                self.ws_clients[ws] = set(topics)

    async def register_sse(self) -> asyncio.Queue[str]:
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=500)  # backpressure: drop if slow
        async with self.lock:
            self.sse_queues.append(q)
        return q

    async def unregister_sse(self, q: asyncio.Queue[str]):
        async with self.lock:
            if q in self.sse_queues:
                self.sse_queues.remove(q)

    async def broadcast(self, env: Dict[str, Any]):
        msg = json.dumps(env, separators=(",", ":"))

        async with self.lock:
            # WS broadcast
            dead = []
            for ws, pats in self.ws_clients.items():
                if topic_match(env["topic"], pats):
                    try:
                        await ws.send_text(msg)
                    except Exception:
                        dead.append(ws)
            for ws in dead:
                self.ws_clients.pop(ws, None)

            # SSE broadcast (drop if queue full)
            for q in self.sse_queues:
                try:
                    q.put_nowait(msg)
                except asyncio.QueueFull:
                    pass


hub = Hub()


async def db_insert_events(tenant_id: str, envs: List[Dict[str, Any]]):
    if not envs:
        return
    rows = [
        (
            tenant_id,
            e["topic"],
            e.get("category"),
            e["timestamp"],
            json.dumps(e["data"]),
        )
        for e in envs
    ]
    sql = """
      INSERT INTO mirror_event (tenant_id, topic, category, ts, payload)
      VALUES (%s,%s,%s,%s,%s::jsonb)
    """
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(sql, rows)


async def db_poll(tenant_id: str, since: int, limit: int, topics: Optional[List[str]]):
    where = ["tenant_id = %s", "seq > %s"]
    params: List[Any] = [tenant_id, since]

    if topics:
        exact = [t for t in topics if not t.endswith(".*")]
        prefixes = [t[:-2] for t in topics if t.endswith(".*")]
        clauses = []
        if exact:
            clauses.append("topic = ANY(%s)")
            params.append(exact)
        if prefixes:
            clauses.append("(" + " OR ".join(["topic LIKE %s"] * len(prefixes)) + ")")
            params.extend([p + "%" for p in prefixes])
        where.append("(" + " OR ".join(clauses) + ")" if clauses else "TRUE")

    sql = f"""
      SELECT seq, event_id, topic, category, ts, payload
      FROM mirror_event
      WHERE {" AND ".join(where)}
      ORDER BY seq ASC
      LIMIT %s
    """
    params.append(limit)

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, tuple(params))
            rows = await cur.fetchall()

    out = []
    for seq, event_id, topic, category, ts, payload in rows:
        out.append(
            {
                "seq": seq,
                "id": str(event_id),
                "topic": topic,
                "category": category,
                "timestamp": ts.isoformat(),
                "data": payload,
            }
        )
    next_since = out[-1]["seq"] if out else since
    return out, next_since


@app.post("/ingest")
async def ingest(
    env: Dict[str, Any] = Body(...),
    tenant_id: str = Query("00000000-0000-0000-0000-000000000000"),
):
    e = normalize(env)
    await db_insert_events(tenant_id, [e])
    await hub.broadcast(e)
    return {"ok": True}


@app.post("/ingest/batch")
async def ingest_batch(
    envs: List[Dict[str, Any]] = Body(...),
    tenant_id: str = Query("00000000-0000-0000-0000-000000000000"),
):
    # Normalize and cap to prevent abuse
    norm = [normalize(e) for e in envs[:2000]]
    await db_insert_events(tenant_id, norm)
    # Fanout (best-effort; don't block batch commit on slow clients)
    for e in norm:
        await hub.broadcast(e)
    return {"ok": True, "count": len(norm)}


@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket):
    await ws.accept()
    await hub.register_ws(ws)
    try:
        await hub.set_ws_topics(ws, ["diamond.*", "mirror.*", "recorder.*"])
        while True:
            msg = await ws.receive_text()
            obj = json.loads(msg)
            if obj.get("op") == "subscribe":
                await hub.set_ws_topics(ws, obj.get("topics") or [])
    except WebSocketDisconnect:
        pass
    finally:
        await hub.unregister_ws(ws)


@app.get("/sse/telemetry")
async def sse_telemetry(topics: str = Query("diamond.*,mirror.*,recorder.*")):
    patterns = set([t.strip() for t in topics.split(",") if t.strip()])
    q = await hub.register_sse()

    async def gen():
        try:
            yield "retry: 1500\n\n"
            while True:
                msg = await q.get()
                env = json.loads(msg)
                if topic_match(env.get("topic", "unknown"), patterns):
                    yield f"data: {msg}\n\n"
        finally:
            await hub.unregister_sse(q)

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/api/telemetry/poll")
async def poll(
    since: int = Query(0),
    limit: int = Query(200),
    topics: str = Query("diamond.*,mirror.*,recorder.*"),
    tenant_id: str = Query("00000000-0000-0000-0000-000000000000"),
):
    tlist = [t.strip() for t in topics.split(",") if t.strip()]
    events, next_since = await db_poll(tenant_id, since, limit, tlist)
    return {"events": events, "next_since": next_since}


@app.get("/export/ndjson")
async def export_ndjson(
    since: int = Query(0),
    limit: int = Query(5000),
    topics: str = Query("diamond.*,mirror.*,recorder.*"),
    tenant_id: str = Query("00000000-0000-0000-0000-000000000000"),
):
    tlist = [t.strip() for t in topics.split(",") if t.strip()]
    events, _ = await db_poll(tenant_id, since, limit, tlist)

    async def gen():
        for e in events:
            yield (json.dumps(e, separators=(",", ":")) + "\n")

    return StreamingResponse(gen(), media_type="application/x-ndjson")


# ---- DB brain (hybrid retrieval) hook ----
def fake_embed_1536(_text: str) -> List[float]:
    # Replace with real embedder (OpenAI/local/etc). Must return length 1536.
    import random

    random.seed(hash(_text) % (2**32))
    return [random.random() for _ in range(1536)]


@app.post("/retrieve")
async def retrieve(payload: Dict[str, Any] = Body(...)):
    """
    payload:
      { tenant_id, query, k? }
    Requires SQL function brain_hybrid_search(tenant, query, qvec, k, rrf_k)
    """
    tenant_id = payload.get("tenant_id") or "00000000-0000-0000-0000-000000000000"
    query = payload.get("query") or ""
    k = int(payload.get("k") or 20)
    rrf_k = int(payload.get("rrf_k") or 60)

    qvec = fake_embed_1536(query)
    # psycopg vector literal: pass as Python list, cast in SQL
    sql = "SELECT chunk_id, doc_id, content, score, vec_rank, fts_rank FROM brain_hybrid_search(%s,%s,%s::vector,%s,%s)"
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, (tenant_id, query, qvec, k, rrf_k))
            rows = await cur.fetchall()

    results = []
    for chunk_id, doc_id, content, score, vec_rank, fts_rank in rows:
        results.append(
            {
                "chunk_id": chunk_id,
                "doc_id": str(doc_id),
                "content": content,
                "score": float(score),
                "vec_rank": vec_rank,
                "fts_rank": fts_rank,
            }
        )
    return JSONResponse({"ok": True, "results": results})
