from __future__ import annotations

import re
from typing import Any, Dict, List, Literal, Tuple

from pydantic import BaseModel, Field

from utils import (
    SourceRef,
    clamp01,
    content_hash_for,
    lines_with_numbers,
    normalize_whitespace,
    stable_id,
    utc_now_iso,
)

TokenType = Literal["word", "symbol", "string", "number", "whitespace", "comment"]


class Token(BaseModel):
    token: str
    token_type: TokenType
    count: int = 1
    initial_confidence: float = Field(ge=0.0, le=1.0)


class MeaningClaim(BaseModel):
    claim: str
    confidence: float = Field(ge=0.0, le=1.0)
    source_ref: str


class EvidencePacket(BaseModel):
    batch_id: str
    ingested_at: str
    language: str
    objective: str
    source_file: str
    content_hash: str
    tokens: List[Token]
    meaning_claims: List[MeaningClaim]
    unknowns: List[str]


_WORD = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_NUMBER = re.compile(r"\b\d+(\.\d+)?\b")
_STRING = re.compile(r"(['\"`])(?:\\.|(?!\1).)*\1")
_COMMENT_LINE = re.compile(r"//.*?$", re.MULTILINE)
_COMMENT_BLOCK = re.compile(r"/\*.*?\*/", re.DOTALL)

# Rough symbol regex: operators, punctuation, etc.
_SYMBOL = re.compile(
    r"==|!=|<=|>=|=>|\+\+|--|\+=|-=|\*=|/=|&&|\|\||[{}()[\].,;:+\-*/%<>=!?|&^~:]"
)

# Known keywords (extend as you like)
TS_KEYWORDS = {
    "async",
    "await",
    "import",
    "export",
    "from",
    "type",
    "interface",
    "class",
    "const",
    "let",
    "var",
    "function",
    "return",
    "extends",
    "implements",
    "new",
    "throw",
    "try",
    "catch",
    "finally",
    "if",
    "else",
    "switch",
    "case",
    "break",
    "continue",
    "for",
    "while",
    "do",
    "in",
    "of",
}


def _strip_comments_for_tokenization(text: str) -> str:
    text = _COMMENT_BLOCK.sub(" ", text)
    text = _COMMENT_LINE.sub(" ", text)
    return text


def tokenize(text: str) -> List[Tuple[str, TokenType]]:
    """
    Deterministic token stream: we extract strings, numbers, words, symbols.
    Whitespace/comments not stored as tokens (we keep it minimal for MVP).
    """
    stripped = _strip_comments_for_tokenization(text)
    tokens: List[Tuple[str, TokenType]] = []

    i = 0
    n = len(stripped)
    while i < n:
        ch = stripped[i]
        if ch.isspace():
            i += 1
            continue

        m = _STRING.match(stripped, i)
        if m:
            tokens.append((m.group(0), "string"))
            i = m.end()
            continue

        m = _NUMBER.match(stripped, i)
        if m:
            tokens.append((m.group(0), "number"))
            i = m.end()
            continue

        m = _WORD.match(stripped, i)
        if m:
            tokens.append((m.group(0), "word"))
            i = m.end()
            continue

        m = _SYMBOL.match(stripped, i)
        if m:
            tokens.append((m.group(0), "symbol"))
            i = m.end()
            continue

        # Unknown single char
        tokens.append((ch, "symbol"))
        i += 1

    return tokens


def build_meaning_claims(
    language: str, tokens: List[Tuple[str, TokenType]], source_file: str, text: str
) -> Tuple[List[MeaningClaim], List[str]]:
    claims: List[MeaningClaim] = []
    unknowns: List[str] = []

    # For MVP: keyword claims + common TS constructs.
    # Attach source refs by searching the first occurrence line (deterministic).
    token_set = {t for (t, tt) in tokens if tt in ("word", "symbol")}

    numbered = lines_with_numbers(text)
    line_map: Dict[str, int] = {}
    for ln, line in numbered:
        for w in _WORD.findall(line):
            if w not in line_map:
                line_map[w] = ln

    def sr(tok: str) -> str:
        ln = line_map.get(tok, 1)
        return SourceRef(source_file, ln, ln).to_str()

    if language.lower() in ("typescript", "javascript", "ts", "js"):
        for kw in sorted(token_set.intersection(TS_KEYWORDS)):
            claims.append(
                MeaningClaim(
                    claim=f"'{kw}' is a JavaScript/TypeScript keyword",
                    confidence=0.95,
                    source_ref=sr(kw),
                )
            )

        # A couple symbol claims
        if "=>" in token_set:
            claims.append(
                MeaningClaim(
                    claim="'=>' is an arrow function / lambda syntax in JS/TS",
                    confidence=0.9,
                    source_ref=sr("=>"),
                )
            )

        # Unknowns: words that look like identifiers but aren't keywords (we keep a small list)
        for tok, tt in tokens:
            if tt == "word" and tok not in TS_KEYWORDS:
                # If it's very short or common, ignore
                if len(tok) <= 2:
                    continue
                unknowns.append(tok)

    else:
        # For other languages, we still collect identifier unknowns
        for tok, tt in tokens:
            if tt == "word" and len(tok) > 2:
                unknowns.append(tok)

    # Deterministic: unique + sorted
    unknowns = sorted(set(unknowns))
    return claims, unknowns


def run_ingest(
    *, source_file: str, language: str, objective: str, text: str
) -> Dict[str, Any]:
    norm_obj = normalize_whitespace(objective)
    toks = tokenize(text)

    # Aggregate token counts deterministically
    counts: Dict[Tuple[str, TokenType], int] = {}
    for t, tt in toks:
        key = (t, tt)
        counts[key] = counts.get(key, 0) + 1

    # Confidence baseline by type
    def conf_for(tt: TokenType, token: str) -> float:
        if tt == "word":
            return 0.9 if token in TS_KEYWORDS else 0.7
        if tt == "symbol":
            return 0.85
        if tt == "string":
            return 0.8
        if tt == "number":
            return 0.85
        return 0.5

    token_models: List[Token] = []
    for (token, tt), c in sorted(counts.items(), key=lambda x: (x[0][1], x[0][0])):
        token_models.append(
            Token(
                token=token,
                token_type=tt,
                count=c,
                initial_confidence=clamp01(conf_for(tt, token)),
            )
        )

    meaning_claims, unknowns = build_meaning_claims(language, toks, source_file, text)

    # Batch id deterministic from (file + language + objective + content hash)
    content_key = f"{source_file}|{language}|{norm_obj}|{hash(text)}"
    batch_id = stable_id("batch", content_key, length=12)

    packet_dict = {
        "batch_id": batch_id,
        "ingested_at": utc_now_iso(),
        "language": language,
        "objective": norm_obj,
        "source_file": source_file,
        "tokens": [t.model_dump() for t in token_models],
        "meaning_claims": [c.model_dump() for c in meaning_claims],
        "unknowns": unknowns,
    }
    packet_dict["content_hash"] = content_hash_for(packet_dict)

    EvidencePacket(**packet_dict)  # validate now
    return packet_dict
