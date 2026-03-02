"""Alchemist: Transform evidence into LexiconEntry[] and RuneDecoderRow[]."""

from __future__ import annotations
from typing import Any

from .ids import stable_id
from .tokenize import stable_sorted


CONTROLLED_PROCESS_TAGS: dict[str, str] = {
    "tokenize": "Split raw input into words/symbol tokens deterministically.",
    "parse": "Infer structure/roles (AST, grammar, scopes).",
    "validate": "Apply schema + rule gates to ensure correctness.",
    "compile": "Translate/build artifacts into executable/binary/optimized form.",
    "render": "Convert structured data into view/output representations.",
    "transport": "Move messages/events across boundaries (ws/http/bus).",
    "storage": "Persist artifacts with indexes + migrations.",
    "dedupe": "Detect collisions + apply merge/fork policy.",
    "governance": "Policies, approvals, decision logs, taxonomy discipline.",
    "test": "Regression harnesses, assertions, replay checks.",
    "deploy": "Release, rollouts, and environment promotion.",
    "observe": "Metrics/logging/tracing and operational visibility.",
}


def build_lexicon_entries(evidence: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract lexicon entries (words) from evidence."""
    lang = evidence["source"].get("language_hint") or "en"
    out: list[dict[str, Any]] = []

    unique_terms = stable_sorted(set(evidence["tokens"]["words"]))
    for term in unique_terms:
        entry_id = stable_id("lex", lang, term.lower(), prefix="lex")

        out.append(
            {
                "schema_version": "1.0.0",
                "lexicon_id": entry_id,
                "language": lang,
                "term": term,
                "morphology": {
                    "prefixes": [],
                    "roots": [],
                    "suffixes": [],
                    "methodology": [
                        "Rule-based segmentation (MVP stub).",
                        "Later: dictionary + affix tables + ML fallback.",
                    ],
                },
                "semantics": {
                    "meaning_claims": [
                        c
                        for c in evidence["claims"]["meaning_claims"]
                        if c["term"] == term
                    ],
                    "synonyms": [],
                    "antonyms": [],
                    "hypernyms": [],
                    "hyponyms": [],
                    "collocations": [],
                    "conceptual_metaphors": [],
                },
                "trace": {
                    "batch_id": evidence["batch_id"],
                    "source_id": evidence["source"]["source_id"],
                },
            }
        )
    return out


def normalize_process_tag(tag: str) -> tuple[str, bool]:
    """Normalize process tag; return tag + is_unknown flag."""
    t = (tag or "").strip().lower()
    if t in CONTROLLED_PROCESS_TAGS.keys():
        return t, False
    if t == "":
        return "unknown_tag", True
    return "unknown_tag", True


def taxonomy_seed_rows() -> list[tuple[str, str]]:
    return [
        (k, v) for k, v in sorted(CONTROLLED_PROCESS_TAGS.items(), key=lambda kv: kv[0])
    ]


def build_rune_rows(evidence: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract rune decoder rows (code symbols) from evidence."""
    language = evidence["source"].get("language_hint") or "unknown"
    out: list[dict[str, Any]] = []

    unique_syms = stable_sorted(set(evidence["tokens"]["code_symbols"]))
    for sym in unique_syms:
        # MVP heuristics: classify symbol type
        if sym.isidentifier():
            sym_type = "identifier"
        elif sym in "{}()[]":
            sym_type = "delimiter"
        elif sym in ("=", "==", "!=", "<", ">", "<=", ">="):
            sym_type = "operator"
        else:
            sym_type = "punctuation_or_operator"

        process_tag, unknown = normalize_process_tag("parse")  # default MVP tag

        rune_id = stable_id("rune", language, sym, process_tag, prefix="rune")

        out.append(
            {
                "schema_version": "1.0.0",
                "rune_id": rune_id,
                "code_language": language,
                "symbol": sym,
                "symbol_type": sym_type,
                "process_tag": process_tag,
                "meaning": {
                    "meaning_claims": [
                        {
                            "claim_id": stable_id(
                                "rune-meaning", sym, process_tag, prefix="claim"
                            ),
                            "claim": f"Symbol '{sym}' meaning depends on language/grammar; decode by parser rules.",
                            "confidence": 0.40 if sym_type != "identifier" else 0.20,
                            "review_required": unknown or (sym_type == "identifier"),
                            "evidence_links": [],
                            "falsification_tests": [
                                "Validate symbol role via AST parsing in target language.",
                                "Confirm usage in nearby code context.",
                            ],
                        }
                    ],
                },
                "use": {
                    "what_it_does": "Decodes the symbol role for code understanding and documentation.",
                    "where_used": ["parser", "lexer", "syntax rules"],
                },
                "methodology": [
                    "MVP: regex tokenization + symbol classification.",
                    "Later: AST extraction + scope analysis + type inference.",
                ],
                "trace": {
                    "batch_id": evidence["batch_id"],
                    "source_id": evidence["source"]["source_id"],
                },
            }
        )
    return out
