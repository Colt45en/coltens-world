"""
Lexicon Query Service — FastAPI endpoint for querying lexicon data.

Provides: POST /lexicon/query
  - term: search for a term
  - k: number of results to return
"""

from typing import Any, Dict, List

# Minimal lexicon store (replace with real DB/files later)
LEXICON: Dict[str, Dict[str, Any]] = {
    "entropy": {
        "term": "entropy",
        "definition": "A measure of disorder/uncertainty; in information theory, expected surprise.",
        "synonyms": ["disorder", "uncertainty"],
        "related": ["information", "thermodynamics", "compression"],
    },
    "algorithm": {
        "term": "algorithm",
        "definition": "A finite procedure for solving a problem.",
        "synonyms": ["procedure", "method"],
        "related": ["program", "optimization"],
    },
    "determinism": {
        "term": "determinism",
        "definition": "The principle that all events are completely determined by prior causes.",
        "synonyms": ["causality", "predictability"],
        "related": ["chaos", "quantum", "randomness"],
    },
    "lexicon": {
        "term": "lexicon",
        "definition": "A collection of words or terms, typically with definitions or contexts.",
        "synonyms": ["vocabulary", "dictionary", "glossary"],
        "related": ["morphology", "semantics", "language"],
    },
}


def query_lexicon(term: str, k: int = 5) -> Dict[str, Any]:
    """
    Query the lexicon for a term.

    Returns:
      - ok: bool
      - query: { term, k }
      - results: [ { term, definition, synonyms, related }, ... ]
    """
    search_term = term.strip().lower()
    results: List[Dict[str, Any]] = []

    # Exact match
    if search_term in LEXICON:
        results.append(LEXICON[search_term])
    else:
        # Substring matches (case-insensitive)
        for k_term, v_data in LEXICON.items():
            if search_term in k_term:
                results.append(v_data)
        results = results[:k]

    return {
        "ok": True,
        "query": {"term": term, "k": k},
        "results": results,
    }
