from __future__ import annotations

import re
from typing import Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field
from utils import clamp01, content_hash_for, stable_id

ProcessTag = Literal[
    "define",
    "call",
    "import",
    "export",
    "assign",
    "type_decl",
    "control_flow",
    "literal",
    "unknown",
]


class Morphology(BaseModel):
    root: str
    affixes: List[str]
    pos: str


class SemanticLens(BaseModel):
    lens_name: str
    meaning: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_links: List[str] = Field(default_factory=list)


class LexiconEntry(BaseModel):
    entry_id: str
    term: str
    language: str
    namespace: str
    morphology: Morphology
    semantic_lenses: List[SemanticLens]
    overall_confidence: float = Field(ge=0.0, le=1.0)
    review_required: bool


class RuneDecoderRow(BaseModel):
    rune_id: str
    symbol: str
    language: str
    namespace: str
    process_tag: ProcessTag
    tag_confidence: float = Field(ge=0.0, le=1.0)
    meaning: str
    methodologies: List[str]
    evidence_links: List[str] = Field(default_factory=list)


_PREFIXES = [
    "un",
    "re",
    "pre",
    "post",
    "anti",
    "de",
    "dis",
    "mis",
    "non",
    "over",
    "under",
    "sub",
    "super",
    "inter",
    "intra",
    "trans",
    "auto",
    "semi",
    "multi",
    "poly",
    "micro",
    "macro",
]
_SUFFIXES = [
    "ing",
    "ed",
    "er",
    "or",
    "ion",
    "tion",
    "sion",
    "ment",
    "ness",
    "ity",
    "able",
    "ible",
    "al",
    "ial",
    "ous",
    "ive",
    "ize",
    "ise",
    "ship",
    "less",
    "ful",
]

# Common TS/React patterns for rune decoding
_RE_IMPORT = re.compile(r"^\s*import\s+.*\s+from\s+['\"].+['\"];?\s*$")
_RE_EXPORT = re.compile(r"^\s*export\s+")
_RE_DEFINE_FUNC = re.compile(r"\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\b")
_RE_DEFINE_CONST_FN = re.compile(r"\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(")
_RE_DEFINE_CLASS = re.compile(r"\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b")
_RE_DEFINE_TYPE = re.compile(r"\b(type|interface)\s+([A-Za-z_][A-Za-z0-9_]*)\b")
_RE_CALL = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(")
_RE_ASSIGN = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*=")


def _morphology(term: str) -> Morphology:
    t = term
    aff: List[str] = []

    # prefix peel (longest-first, deterministic)
    pref = ""
    for p in sorted(_PREFIXES, key=len, reverse=True):
        if t.startswith(p) and len(t) - len(p) >= 3:
            pref = p
            break
    if pref:
        aff.append(pref + "-")
        t = t[len(pref) :]

    # suffix peel (longest-first)
    suf = ""
    for s in sorted(_SUFFIXES, key=len, reverse=True):
        if t.endswith(s) and len(t) - len(s) >= 3:
            suf = s
            break
    if suf:
        aff.append("-" + suf)
        t = t[: -len(suf)]

    pos = "identifier"
    if term in {
        "async",
        "await",
        "import",
        "export",
        "return",
        "type",
        "interface",
        "class",
        "const",
        "let",
    }:
        pos = "keyword"

    return Morphology(root=t, affixes=aff, pos=pos)


def _namespace_for(term: str, language: str) -> str:
    # Simple deterministic routing for MVP
    if language.lower() in ("typescript", "javascript", "ts", "js"):
        if term.lower() in {
            "useeffect",
            "usestate",
            "usememo",
            "usecallback",
            "useref",
            "uselayouteffect",
        }:
            return "react"
        if term.lower() in {"three", "mesh", "scene", "camera", "vector3"}:
            return "graphics"
        return "code"
    return "general"


def _classify_process_tag(line: str) -> Tuple[ProcessTag, float, Optional[str]]:
    s = line.strip()

    if _RE_IMPORT.match(s):
        return "import", 0.95, "import statement"
    if _RE_EXPORT.match(s):
        return "export", 0.9, "export marker"
    m = _RE_DEFINE_TYPE.search(s)
    if m:
        return "type_decl", 0.92, f"{m.group(1)} {m.group(2)}"
    m = _RE_DEFINE_CLASS.search(s)
    if m:
        return "define", 0.9, f"class {m.group(1)}"
    m = _RE_DEFINE_FUNC.search(s)
    if m:
        return "define", 0.9, f"function {m.group(1)}"
    m = _RE_DEFINE_CONST_FN.search(s)
    if m:
        return "define", 0.88, f"const {m.group(1)} = ("

    # control flow
    if any(
        s.startswith(k)
        for k in ("if ", "for ", "while ", "switch ", "try", "catch", "return ")
    ):
        return "control_flow", 0.85, "control keyword"

    # assignment
    if _RE_ASSIGN.search(s):
        return "assign", 0.75, "assignment"

    # call
    m = _RE_CALL.search(s)
    if m:
        return "call", 0.7, f"call {m.group(1)}(...)"

    # literal
    if s.startswith(("'", '"', "`")) or s[:1].isdigit():
        return "literal", 0.7, "literal"

    return "unknown", 0.4, None


def _meaning_for_rune(symbol: str, namespace: str) -> str:
    # Deterministic mapping for MVP; you can expand these easily.
    lower = symbol.lower()
    if lower == "useeffect":
        return "React hook for side effects"
    if lower == "usestate":
        return "React hook for component state"
    if lower == "usememo":
        return "React hook to memoize computed values"
    if lower == "usecallback":
        return "React hook to memoize function references"
    if lower == "useref":
        return "React hook to hold mutable references"
    if namespace == "import":
        return "Imports a module dependency"
    if namespace == "export":
        return "Exports a symbol from the module"
    return f"Code symbol '{symbol}' in namespace '{namespace}'"


def run_transform(*, packet: Dict[str, Any], source_text: str) -> Dict[str, Any]:
    language = packet["language"]
    source_file = packet["source_file"]

    # Build per-line rune rows deterministically
    lines = source_text.splitlines()
    rune_rows: List[Dict[str, Any]] = []

    for i, line in enumerate(lines, start=1):
        tag, tag_conf, hint = _classify_process_tag(line)
        if tag == "unknown":
            continue

        # pick a primary symbol deterministically: first identifier on the line
        ids = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", line)
        symbol = ids[0] if ids else tag

        namespace = tag
        meaning = _meaning_for_rune(symbol, namespace)
        methodologies = []
        if tag == "import":
            methodologies = ["dependency_resolution", "static_analysis"]
        elif tag == "define":
            methodologies = ["ast_pattern", "signature_extraction"]
        elif tag == "call":
            methodologies = ["call_graph_hint", "side_effect_inference"]
        elif tag == "type_decl":
            methodologies = ["type_system_indexing", "schema_alignment"]
        elif tag == "assign":
            methodologies = ["data_flow_hint", "mutation_detection"]
        else:
            methodologies = ["pattern_match"]

        evidence = [f"{source_file}:L{i}"]
        content_key = f"{language}|{namespace}|{symbol}|{evidence[0]}"
        rune_rows.append(
            {
                "rune_id": stable_id("rune", content_key, length=10),
                "symbol": symbol,
                "language": language,
                "namespace": namespace,
                "process_tag": tag,
                "tag_confidence": clamp01(tag_conf),
                "meaning": meaning,
                "methodologies": methodologies,
                "evidence_links": evidence,
            }
        )

    # Lexicon entries from tokens + claims
    # Use the token list, only word tokens, deterministic unique
    word_tokens = sorted(
        {t["token"] for t in packet["tokens"] if t["token_type"] == "word"}
    )
    lex_entries: List[Dict[str, Any]] = []

    # Build a small evidence map from packet meaning claims
    claim_map: Dict[str, List[Dict[str, Any]]] = {}
    for c in packet["meaning_claims"]:
        # naive association: keyword in claim like 'async'
        m = re.findall(r"'([A-Za-z_][A-Za-z0-9_]*)'", c["claim"])
        for term in m:
            claim_map.setdefault(term, []).append(c)

    for term in word_tokens:
        namespace = _namespace_for(term, language)
        morph = _morphology(term)

        lenses: List[Dict[str, Any]] = []
        # If we have a direct claim, use it as a strong lens
        if term in claim_map:
            for c in sorted(
                claim_map[term],
                key=lambda x: (x["confidence"], x["claim"]),
                reverse=True,
            ):
                lenses.append(
                    {
                        "lens_name": "linguistic",
                        "meaning": c["claim"],
                        "confidence": clamp01(float(c["confidence"])),
                        "evidence_links": [c["source_ref"]],
                    }
                )
        else:
            # generic lens
            lenses.append(
                {
                    "lens_name": "code_symbol",
                    "meaning": f"Identifier '{term}' appears in source and may represent a symbol",
                    "confidence": 0.7,
                    "evidence_links": [source_file],
                }
            )

        overall = min(lens["confidence"] for lens in lenses) if lenses else 0.0
        review_required = overall < 0.8

        content_key = (
            f"{language}|{namespace}|{term}|{morph.root}|{','.join(morph.affixes)}"
        )
        lex_entries.append(
            {
                "entry_id": stable_id("lex", content_key, length=10),
                "term": term,
                "language": language,
                "namespace": namespace,
                "morphology": morph.model_dump(),
                "semantic_lenses": lenses,
                "overall_confidence": clamp01(float(overall)),
                "review_required": bool(review_required),
            }
        )

    out = {
        "batch_id": packet["batch_id"],
        "lexicon_entries": sorted(
            lex_entries, key=lambda x: (x["language"], x["namespace"], x["term"])
        ),
        "rune_rows": sorted(
            rune_rows,
            key=lambda x: (x["language"], x["namespace"], x["symbol"], x["rune_id"]),
        ),
    }

    # Validate shapes
    for e in out["lexicon_entries"]:
        LexiconEntry(**e)
    for r in out["rune_rows"]:
        RuneDecoderRow(**r)

    out["content_hash"] = content_hash_for(out)
    return out
