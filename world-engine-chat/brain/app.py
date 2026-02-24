from __future__ import annotations
import re
import json
import sqlite3
from typing import Any, Dict, List, Optional, Tuple, cast
from fastapi import FastAPI
from pydantic import BaseModel, Field

DB_PATH = "lexicon.db"

app = FastAPI(title="World Engine Brain", version="1.0.0")


# ---------------------------
# Contracts (mirror nucleus)
# ---------------------------

class ChatContextScene(BaseModel):
    mapId: Optional[str] = None
    playerPos: Optional[Tuple[float, float, float]] = None


class ChatContext(BaseModel):
    selection: Optional[str] = None
    openFiles: Optional[List[str]] = None
    scene: Optional[ChatContextScene] = None


class ChatRequest(BaseModel):
    convoId: str
    userId: str
    persona: str
    text: str
    context: Optional[ChatContext] = None


class LexiconHit(BaseModel):
    id: str
    topic: str
    meaning: str
    tags: List[str]
    confidence: float


class ToolCall(BaseModel):
    name: str
    args: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------
# Evidence Block (structured UI)
# ---------------------------

class EvidenceGroundingRow(BaseModel):
    token: str = Field(min_length=1, max_length=128)
    lexId: str = Field(min_length=1, max_length=128)
    confidence: float = Field(ge=0.0, le=1.0)

    class Config:
        extra = "forbid"


class EvidenceActionRow(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    argsPreview: str = Field(default="", max_length=512)

    class Config:
        extra = "forbid"


class EvidenceCitation(BaseModel):
    type: str = Field(default="lexicon")
    ref: str = Field(min_length=1, max_length=128)

    class Config:
        extra = "forbid"


class EvidenceBlock(BaseModel):
    """
    Evidence = deterministic, structured UI payload.
    text stays human-friendly.
    """
    schemaInfo: Dict[str, str] = Field(default_factory=lambda: {"name": "brain.chat.evidence", "version": "1.0.0"})
    grounding: List[EvidenceGroundingRow] = Field(default_factory=lambda: [])
    actions: List[EvidenceActionRow] = Field(default_factory=lambda: [])
    citations: List[EvidenceCitation] = Field(default_factory=lambda: [])

    class Config:
        extra = "forbid"


class ChatResponse(BaseModel):
    convoId: str
    text: str
    toolCalls: Optional[List[ToolCall]] = None
    lexicon: Optional[Dict[str, Any]] = None
    citations: Optional[List[Dict[str, str]]] = None
    evidence: Optional[EvidenceBlock] = None

    class Config:
        extra = "forbid"


class ToolResult(BaseModel):
    convoId: str
    toolName: str
    ok: bool
    result: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


# ---------------------------
# SQLite Lexicon
# ---------------------------

def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = db()
    cur = conn.cursor()
    cur.execute("""
      CREATE TABLE IF NOT EXISTS lexicon_entries (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        meaning TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]'
      )
    """)
    conn.commit()

    # Seed a few entries if empty
    cur.execute("SELECT COUNT(*) AS c FROM lexicon_entries")
    if cur.fetchone()["c"] == 0:
        seed = [
            ("lex_state_v1", "state", "A configuration of a system at a point in time; in code: a set of values stored in memory.", ["engine","runtime","math"]),
            ("lex_lexicon_v1", "lexicon", "A structured meaning index: symbols→concepts→procedures, queryable by the brain.", ["brain","knowledge","contracts"]),
            ("lex_toolcall_v1", "toolcall", "A structured command from the brain that asks a tool runtime (UI/server) to execute an action.", ["agents","runtime"])
        ]
        cur.executemany(
            "INSERT INTO lexicon_entries(id, topic, meaning, tags_json) VALUES (?,?,?,?)",
            [(i,t,m,json.dumps(tags)) for (i,t,m,tags) in seed]
        )
        conn.commit()
    conn.close()

init_db()

def tokenize(text: str) -> List[str]:
    # basic tokenization; your next step is lexicon-aware parsing
    return [t for t in re.findall(r"\w+", text.lower()) if t]

def lexicon_query(q: str, limit: int = 8) -> List[LexiconHit]:
    q = q.strip().lower()
    conn = db()
    cur = conn.cursor()
    # topic exact match first, then contains
    cur.execute("""
      SELECT id, topic, meaning, tags_json,
        CASE
          WHEN topic = ? THEN 0
          WHEN topic LIKE ? THEN 1
          ELSE 2
        END AS rank
      FROM lexicon_entries
      WHERE topic = ? OR topic LIKE ?
      ORDER BY rank ASC, topic ASC
      LIMIT ?
    """, (q, f"%{q}%", q, f"%{q}%", limit))
    rows = cur.fetchall()
    conn.close()

    hits: List[LexiconHit] = []
    for r in rows:
        tags = json.loads(r["tags_json"] or "[]")
        conf = 0.98 if r["topic"] == q else 0.75
        hits.append(LexiconHit(
            id=r["id"],
            topic=r["topic"],
            meaning=r["meaning"],
            tags=tags,
            confidence=conf
        ))
    return hits

def lexicon_resolve(text: str, limit_per_token: int = 1) -> Dict[str, Any]:
    tokens = tokenize(text)
    token_map: List[Dict[str, Any]] = []
    hits: Dict[str, LexiconHit] = {}

    for tok in tokens:
        h = lexicon_query(tok, limit=limit_per_token)
        if not h:
            continue
        best = h[0]
        token_map.append({"token": tok, "lexId": best.id, "confidence": best.confidence})
        hits[best.id] = best

    return {
        "hits": [h.model_dump() for h in hits.values()],
        "tokenMap": token_map
    }

def lexicon_ingest(topic: str, meaning: str, tags: List[str]) -> str:
    topic = topic.strip().lower()
    entry_id = f"lex_{topic}_v1"
    conn = db()
    cur = conn.cursor()
    cur.execute("""
      INSERT OR REPLACE INTO lexicon_entries(id, topic, meaning, tags_json)
      VALUES (?,?,?,?)
    """, (entry_id, topic, meaning.strip(), json.dumps(tags)))
    conn.commit()
    conn.close()
    return entry_id


# ---------------------------
# Brain Logic (minimal but real)
# ---------------------------

def detect_toolcalls(text: str) -> List[ToolCall]:
    t = text.lower().strip()
    toolcalls: List[ToolCall] = []

    # record screen 12s [with audio]
    m = re.search(r"\brecord\s+screen\b(.*)", t)
    if m:
        duration_ms = parse_duration_ms(t, 5000)
        system_audio = bool(re.search(r"\b(system\s+audio|with\s+audio|audio\s+on|include\s+audio)\b", t))
        toolcalls.append(ToolCall(name="record_screen", args={"durationMs": duration_ms, "systemAudio": system_audio}))

    # record audio 10s
    m2 = re.search(r"\brecord\s+audio\b(.*)", t) or re.search(r"\bstart\s+audio\s+recording\b(.*)", t)
    if m2:
        duration_ms = parse_duration_ms(t, 5000)
        toolcalls.append(ToolCall(name="record_audio", args={"durationMs": duration_ms}))

    # ingest lexicon: "define <topic>: <meaning> #tag #tag"
    m3 = re.search(r"^\s*define\s+([a-z0-9_]+)\s*:\s*(.+)$", t)
    if m3:
        topic = m3.group(1)
        meaning = m3.group(2)
        tags = re.findall(r"#([a-z0-9_]+)", meaning)
        # strip tags from meaning
        meaning_clean = re.sub(r"\s*#([a-z0-9_]+)", "", meaning).strip()
        toolcalls.append(ToolCall(name="lexicon_ingest", args={"topic": topic, "meaning": meaning_clean, "tags": tags}))

    return toolcalls

def parse_duration_ms(text: str, default_ms: int) -> int:
    text = text.lower()
    ms = 0
    mm = re.search(r"(\d+(?:\.\d+)?)\s*m\b", text)
    ss = re.search(r"(\d+(?:\.\d+)?)\s*s\b", text)
    if mm:
        ms += int(float(mm.group(1)) * 60_000)
    if ss:
        ms += int(float(ss.group(1)) * 1_000)
    if ms == 0:
        # allow "record screen 12" => seconds
        bare = re.search(r"\brecord(?:\s+screen|\s+audio)?\s+(\d+(?:\.\d+)?)\b", text)
        if bare:
            ms = int(float(bare.group(1)) * 1_000)
    if ms <= 0:
        ms = default_ms
    return ms


def _safe_str(x: Any, max_len: int = 240) -> str:
    """Safely convert to string with length limit."""
    s = "" if x is None else str(x)
    if len(s) > max_len:
        return s[: max_len - 3] + "..."
    return s


def _safe_float(x: Any, default: float = 0.0) -> float:
    """Safely convert to float [0.0, 1.0]."""
    try:
        v = float(x)
        if v != v:  # NaN
            return default
        if v < 0.0:
            return 0.0
        if v > 1.0:
            return 1.0
        return v
    except Exception:
        return default


def _args_preview(args: Any) -> str:
    """Deterministic shallow preview of args (prevents huge dumps)."""
    if isinstance(args, dict):
        keys: List[str] = sorted(str(k) for k in cast(Dict[str, Any], args).keys())
        parts: List[str] = []
        for k in keys[:8]:
            v: Any = args.get(k)  # type: ignore[union-attr]
            parts.append(f"{k}={_safe_str(v, 60)}")
        return "{ " + ", ".join(parts) + (" …" if len(keys) > 8 else "") + " }"
    return _safe_str(args, 220)


def _build_response_text(req: ChatRequest, tok_map: List[Dict[str, Any]], toolcalls: List[ToolCall]) -> str:
    """Assemble the human-friendly response text."""
    grounding_lines: List[str] = []
    if tok_map:
        grounding_lines.append("Lexicon grounding:")
        for tm in tok_map[:6]:
            grounding_lines.append(f"- {tm['token']} → {tm['lexId']} ({tm['confidence']:.2f})")

    action_lines: List[str] = []
    if toolcalls:
        action_lines.append("Actions queued:")
        for tc in toolcalls:
            action_lines.append(f"- toolcall: {tc.name} args={tc.args}")

    text = "\n".join(
        [f"You said: {req.text}"]
        + ([""] + grounding_lines if grounding_lines else [])
        + ([""] + action_lines if action_lines else [])
        + (["", "If you want deeper integration: send scene/openFiles/selection in context and I'll ground responses against world state + lexicon."])
    )
    return text


def _build_evidence_block(tok_map: List[Dict[str, Any]], toolcalls: List[ToolCall], citations: List[Dict[str, str]]) -> EvidenceBlock:
    """Construct evidence block from grounding, actions, and citations."""
    return EvidenceBlock(
        grounding=[
            EvidenceGroundingRow(
                token=_safe_str(tm.get("token", "?"), 128),
                lexId=_safe_str(tm.get("lexId", "?"), 128),
                confidence=_safe_float(tm.get("confidence", 0.0))
            )
            for tm in tok_map[:12]
            if str(tm.get("token", "")).strip() and str(tm.get("lexId", "")).strip()
        ],
        actions=[
            EvidenceActionRow(
                name=_safe_str(tc.name, 128),
                argsPreview=_safe_str(_args_preview(tc.args), 512)
            )
            for tc in toolcalls[:12]
        ],
        citations=[
            EvidenceCitation(type="lexicon", ref=c["ref"])
            for c in citations[:8]
            if c.get("ref")
        ]
    )


def brain_chat(req: ChatRequest) -> ChatResponse:
    # Lexicon resolve first (grounding)
    resolved = lexicon_resolve(req.text)

    # Tool calls (agentic)
    toolcalls = detect_toolcalls(req.text)

    # Extract results
    lex_hits = resolved.get("hits", [])
    tok_map = resolved.get("tokenMap", [])

    # Build citations
    citations: List[Dict[str, str]] = []
    for h in lex_hits[:5]:
        hid = h.get("id")
        if isinstance(hid, str) and hid:
            citations.append({"type": "lexicon", "ref": hid})

    # Build response text
    text = _build_response_text(req, tok_map, toolcalls)

    # Build evidence block
    evidence = _build_evidence_block(tok_map, toolcalls, citations)

    # Build payload
    payload = {
        "hits": lex_hits,
        "tokenMap": tok_map
    }

    return ChatResponse(
        convoId=req.convoId,
        text=text,
        toolCalls=list(toolcalls) if toolcalls else None,
        lexicon=payload if (lex_hits or tok_map) else None,
        citations=citations if citations else None,
        evidence=evidence if (evidence.grounding or evidence.actions or evidence.citations) else None
    )


@app.post("/brain/tool_result", response_model=ChatResponse)
def brain_tool_result(res: ToolResult) -> ChatResponse:
    # Handle lexicon ingest tool on the brain side too (even though UI can run it, better as brain/server tool)
    if res.toolName == "lexicon_ingest" and res.ok:
        topic = str(res.result.get("topic", "")).strip().lower()
        meaning = str(res.result.get("meaning", "")).strip()
        tags_raw = res.result.get("tags", [])
        tags: List[str] = []
        if isinstance(tags_raw, list):
            tags = [str(t) for t in cast(List[Any], tags_raw) if isinstance(t, (str, int, float))]
        if topic and meaning:
            entry_id = lexicon_ingest(topic, meaning, tags)
            txt = f"✅ Lexicon updated: {topic} → {entry_id}\nMeaning: {meaning}\nTags: {tags}"
            evidence = EvidenceBlock(
                citations=[EvidenceCitation(type="lexicon", ref=entry_id)]
            )
            return ChatResponse(
                convoId=res.convoId,
                text=txt,
                citations=[{"type": "lexicon", "ref": entry_id}],
                evidence=evidence
            )

    # Generic response
    if res.ok:
        txt = f"✅ Tool complete: {res.toolName}\nResult: {json.dumps(res.result, indent=2)}"
    else:
        txt = f"❌ Tool failed: {res.toolName}\nError: {res.error or 'unknown'}\nPartial: {json.dumps(res.result, indent=2)}"

    evidence = EvidenceBlock(
        actions=[EvidenceActionRow(name=_safe_str(res.toolName, 128), argsPreview=_safe_str(_args_preview(res.result), 512))]
    )

    return ChatResponse(
        convoId=res.convoId,
        text=txt,
        evidence=evidence
    )


# Optional Lexicon API (direct)
class LexiconIngestRequest(BaseModel):
    topic: str
    meaning: str
    tags: List[str] = Field(default_factory=list)

class LexiconQueryRequest(BaseModel):
    q: str
    limit: int = 8

@app.post("/lexicon/query")
def api_lexicon_query(req: LexiconQueryRequest):
    hits = lexicon_query(req.q, req.limit)
    return {"hits": [h.model_dump() for h in hits]}

@app.post("/lexicon/resolve")
def api_lexicon_resolve(req: Dict[str, Any]):
    text = str(req.get("text", ""))
    return lexicon_resolve(text)

@app.post("/lexicon/ingest")
def api_lexicon_ingest(req: LexiconIngestRequest):
    entry_id = lexicon_ingest(req.topic, req.meaning, req.tags)
    return {"id": entry_id}
