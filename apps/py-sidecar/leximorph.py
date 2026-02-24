#!/usr/bin/env python3
"""
Leximorph v2 (local-first)

Automated word + code analysis system:
- English morphological analysis (prefix/root/suffix heuristics + seed lists)
- JS/TS identifier tokenization + metadata
- HTML tag/attribute/class/id tokenization
- SQLite v2 storage (migrations, part index, provenance, review queue)
- Batch ingestion (bounded file scan)
- CLI for init/analyze/query/search/review/ingest/export

This module keeps backwards-compatible exports used elsewhere:
- LexiStore
- build_registry
- EnglishMorphAnalyzer / IdentifierAnalyzer / HtmlAnalyzer
"""

from __future__ import annotations

import argparse
import dataclasses
import fnmatch
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Protocol, Sequence


ANALYZER_VERSION = "leximorph.v2.0.0"
SCHEMA_VERSION = "2"
DEFAULT_REVIEW_CONFIDENCE = 0.65


def utc_now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def stable_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stable_hash_obj(obj: Any) -> str:
    return sha256_hex(stable_json(obj).encode("utf-8"))


def normalize_text(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip()).lower()


def clamp_int(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def line_col_from_offset(text: str, offset: int) -> tuple[int, int]:
    offset = clamp_int(offset, 0, len(text))
    line = text.count("\n", 0, offset) + 1
    last_nl = text.rfind("\n", 0, offset)
    col = offset + 1 if last_nl == -1 else offset - last_nl
    return line, col


_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'\-]*")
_IDENTIFIER_RE = re.compile(r"\b[A-Za-z_][A-Za-z0-9_]*\b")
_HTML_TAG_SNIPPET_RE = re.compile(r"<\s*[A-Za-z][A-Za-z0-9:-]*[^>]*>", re.DOTALL)


def extract_words_with_spans(text: str) -> list[tuple[str, int, int]]:
    return [(m.group(0), m.start(), m.end()) for m in _WORD_RE.finditer(text)]


def extract_identifiers_with_spans(text: str) -> list[tuple[str, int, int]]:
    return [(m.group(0), m.start(), m.end()) for m in _IDENTIFIER_RE.finditer(text)]


def extract_html_tags_with_spans(text: str) -> list[tuple[str, int, int]]:
    return [(m.group(0), m.start(), m.end()) for m in _HTML_TAG_SNIPPET_RE.finditer(text)]


def detect_identifier_style(s: str) -> str:
    if "-" in s and "_" not in s:
        return "kebab-case"
    if "_" in s and "-" not in s:
        if s.upper() == s and re.search(r"[A-Z]", s):
            return "SCREAMING_SNAKE"
        return "snake_case"
    if re.search(r"[A-Z]", s) and re.search(r"[a-z]", s):
        return "camelCase" if re.match(r"^[a-z]", s) else "PascalCase"
    if re.fullmatch(r"[a-z0-9]+", s):
        return "lower"
    if re.fullmatch(r"[A-Z0-9]+", s):
        return "upper"
    return "unknown"


def split_identifier(s: str) -> list[str]:
    if not s:
        return []
    chunks = re.split(r"[_\-]+", s)
    out: list[str] = []
    token_pat = re.compile(
        r"""
        [A-Z]+(?=[A-Z][a-z]) |
        [A-Z]?[a-z]+         |
        [A-Z]+               |
        \d+
        """,
        re.VERBOSE,
    )
    for chunk in chunks:
        if not chunk:
            continue
        out.extend(token_pat.findall(chunk))
    return out


def normalize_identifier_token(token: str) -> str:
    return token.strip().lower()


@dataclass(frozen=True)
class AnalyzedEntry:
    entry: str
    kind: str
    language: str
    parts: Dict[str, Any]
    meta: Dict[str, Any]
    created_at_utc: str = dataclasses.field(default_factory=utc_now_iso)


@dataclass(frozen=True)
class ProvenanceRecord:
    source_path: Optional[str] = None
    source_kind: str = "text"  # file|text|http
    workspace_root: Optional[str] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    col_start: Optional[int] = None
    col_end: Optional[int] = None
    snippet: Optional[str] = None
    ingest_mode: str = "on_demand"  # on_demand|batch


class Analyzer(Protocol):
    def supports(self, language: str, kind: str) -> bool: ...
    def analyze(self, text: str, language: str, kind: str) -> AnalyzedEntry: ...


class AnalyzerRegistry:
    def __init__(self) -> None:
        self._plugins: list[Analyzer] = []

    def register(self, plugin: Analyzer) -> None:
        self._plugins.append(plugin)

    def analyze(self, text: str, language: str, kind: str) -> AnalyzedEntry:
        for p in self._plugins:
            if p.supports(language, kind):
                return p.analyze(text=text, language=language, kind=kind)
        raise ValueError(f"No analyzer registered for language={language} kind={kind}")


_DATA_DIR = Path(__file__).resolve().parent / "data" / "leximorph"

DEFAULT_PREFIXES = [
    "anti", "auto", "bi", "co", "counter", "de", "dis", "down", "extra",
    "hyper", "il", "im", "in", "inter", "ir", "micro", "mis", "mono",
    "multi", "non", "over", "post", "pre", "pro", "re", "semi", "sub",
    "super", "trans", "tri", "ultra", "un", "under", "up",
]

DEFAULT_SUFFIXES = [
    "ability", "able", "ably", "acy", "al", "ally", "ance", "ant", "ary",
    "ation", "ative", "ed", "en", "ence", "ent", "er", "ers", "ery",
    "es", "est", "ful", "hood", "ible", "ibly", "ic", "ical", "ically",
    "ing", "ion", "ish", "ism", "ist", "ity", "ive", "ization", "ize",
    "less", "ly", "ment", "ness", "or", "ous", "ously", "s", "ship", "tion",
    "ward", "wards", "y",
]

DEFAULT_ROOTS = [
    "believe", "build", "write", "code", "struct", "press", "compute", "form",
    "act", "logic", "narrate", "view", "move", "place", "learn", "lock",
    "kind", "happy", "run", "use", "name", "user", "type", "script", "style",
]

DEFAULT_EXCEPTIONS: dict[str, dict[str, Any]] = {
    "unbelievable": {"prefix": "un-", "root": "believe", "suffix": "-able"},
    "running": {"prefix": None, "root": "run", "suffix": "-ing"},
    "happiness": {"prefix": None, "root": "happy", "suffix": "-ness"},
    "unlockable": {
        "prefix": "un-",
        "root": "lock",
        "suffix": "-able",
        "candidates": [
            {"prefix": "un-", "root": "lock", "suffix": "-able", "note": "can be unlocked"},
            {"prefix": None, "root": "unlock", "suffix": "-able", "note": "able to unlock"},
        ],
        "review_required": True,
    },
}


def _load_json_file(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_seed_list(filename: str, fallback: list[str]) -> list[str]:
    path = _DATA_DIR / filename
    if path.exists():
        try:
            data = _load_json_file(path)
            if isinstance(data, list):
                return [str(x).strip().lower() for x in data if str(x).strip()]
        except Exception:
            pass
    return list(fallback)


def _load_exception_map() -> dict[str, dict[str, Any]]:
    path = _DATA_DIR / "english_exceptions.json"
    if path.exists():
        try:
            data = _load_json_file(path)
            if isinstance(data, dict):
                out: dict[str, dict[str, Any]] = {}
                for k, v in data.items():
                    if isinstance(v, dict):
                        out[str(k).lower()] = dict(v)
                return out
        except Exception:
            pass
    return dict(DEFAULT_EXCEPTIONS)


def _best_affix_matches(word: str, candidates: Sequence[str], is_prefix: bool) -> list[str]:
    w = word.lower()
    matches: list[str] = []
    for c in candidates:
        if not c or len(c) >= len(w):
            continue
        if is_prefix and w.startswith(c):
            matches.append(c)
        elif (not is_prefix) and w.endswith(c):
            matches.append(c)
    matches.sort(key=len, reverse=True)
    return matches


def _normalize_root_variants(root: str) -> list[tuple[str, str]]:
    root = root.lower()
    out: list[tuple[str, str]] = [(root, "raw")]
    if not root:
        return out
    if len(root) >= 3 and not root.endswith("e"):
        out.append((root + "e", "restore_trailing_e"))
    if root.endswith("i") and len(root) >= 3:
        out.append((root[:-1] + "y", "i_to_y"))
    if len(root) >= 4 and root[-1] == root[-2] and root[-1] not in "aeiou":
        out.append((root[:-1], "drop_double_consonant"))
    if root.endswith("s") and len(root) >= 4:
        out.append((root[:-1], "drop_plural_s"))
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for r, tag in out:
        if r and r not in seen:
            uniq.append((r, tag))
            seen.add(r)
    return uniq


class EnglishMorphAnalyzer:
    def __init__(self) -> None:
        self.prefixes = _load_seed_list("english_prefixes.json", DEFAULT_PREFIXES)
        self.suffixes = _load_seed_list("english_suffixes.json", DEFAULT_SUFFIXES)
        self.known_roots = set(_load_seed_list("english_roots_seed.json", DEFAULT_ROOTS))
        self.exceptions = _load_exception_map()

    def supports(self, language: str, kind: str) -> bool:
        return language in ("en", "english") and kind in ("word", "token")

    def _score_root(self, root: str) -> tuple[int, dict[str, int]]:
        score = 0
        breakdown: dict[str, int] = {}
        if len(root) >= 3:
            score += 2
            breakdown["len>=3"] = 2
        if len(root) >= 5:
            score += 1
            breakdown["len>=5"] = 1
        if root in self.known_roots:
            score += 4
            breakdown["known_root"] = 4
        if re.fullmatch(r"[a-z]+", root):
            score += 1
            breakdown["alpha_only"] = 1
        return score, breakdown

    def _candidate(self, word: str, prefix: str | None, suffix: str | None) -> dict[str, Any]:
        core = word
        rule_hits: list[str] = []
        if prefix and core.startswith(prefix):
            core = core[len(prefix):]
            rule_hits.append("prefix_split")
        if suffix and core.endswith(suffix):
            core = core[: -len(suffix)]
            rule_hits.append("suffix_split")

        best_root = core
        best_score, best_breakdown = self._score_root(core)
        root_norm_rule = "raw"
        for variant, tag in _normalize_root_variants(core):
            sc, bd = self._score_root(variant)
            if sc > best_score:
                best_root, best_score, best_breakdown, root_norm_rule = variant, sc, bd, tag
        if root_norm_rule != "raw":
            rule_hits.append(root_norm_rule)
        return {
            "prefix": f"{prefix}-" if prefix else None,
            "root": best_root or None,
            "suffix": f"-{suffix}" if suffix else None,
            "raw_core": core,
            "score": best_score,
            "score_breakdown": best_breakdown,
            "rule_hits": rule_hits,
        }

    def analyze(self, text: str, language: str, kind: str) -> AnalyzedEntry:
        raw = text.strip()
        norm = re.sub(r"[^A-Za-z']+", "", raw)
        lower = norm.lower()
        if not lower:
            return AnalyzedEntry(
                entry=raw,
                kind="word",
                language="en",
                parts={"prefix": None, "root": None, "suffix": None},
                meta={
                    "normalized": "",
                    "confidence": 0.0,
                    "analyzer_version": ANALYZER_VERSION,
                    "rule_hits": ["empty"],
                    "candidates": [],
                    "review_required": True,
                },
            )

        exc = self.exceptions.get(lower)
        if exc:
            parts = {"prefix": exc.get("prefix"), "root": exc.get("root"), "suffix": exc.get("suffix")}
            review_required = bool(exc.get("review_required", False))
            return AnalyzedEntry(
                entry=raw,
                kind="word",
                language="en",
                parts=parts,
                meta={
                    "normalized": lower,
                    "confidence": 0.9 if not review_required else 0.6,
                    "analyzer_version": ANALYZER_VERSION,
                    "rule_hits": ["exception_match"],
                    "score_breakdown": {"exception_match": 1},
                    "candidates": exc.get("candidates", []),
                    "review_required": review_required,
                },
            )

        prefix_candidates = [None] + _best_affix_matches(lower, self.prefixes, True)[:4]
        suffix_candidates = [None] + _best_affix_matches(lower, self.suffixes, False)[:6]
        for forced in ("ation", "ization", "tion", "ing", "ness"):
            if lower.endswith(forced) and forced not in suffix_candidates:
                suffix_candidates.append(forced)

        candidates: list[dict[str, Any]] = []
        seen: set[tuple[str | None, str | None]] = set()
        for p in prefix_candidates:
            for s in suffix_candidates:
                key = (p, s)
                if key in seen:
                    continue
                seen.add(key)
                if p and s and len(lower) - len(p) - len(s) < 2:
                    continue
                candidates.append(self._candidate(lower, p, s))
        if not candidates:
            candidates = [self._candidate(lower, None, None)]

        candidates.sort(
            key=lambda c: (c["score"], 1 if c["prefix"] else 0, 1 if c["suffix"] else 0, len(c["root"] or "")),
            reverse=True,
        )
        best = candidates[0]
        second_score = candidates[1]["score"] if len(candidates) > 1 else -999
        ambiguity_delta = best["score"] - second_score

        base_conf = 0.2 + min(best["score"], 8) * 0.09
        if best["root"] in self.known_roots:
            base_conf += 0.12
        if ambiguity_delta <= 1:
            base_conf -= 0.15
        if len(best["root"] or "") < 3:
            base_conf -= 0.2
        confidence = max(0.0, min(1.0, round(base_conf, 4)))
        review_required = confidence < DEFAULT_REVIEW_CONFIDENCE or ambiguity_delta <= 1 or len(best["root"] or "") < 3

        return AnalyzedEntry(
            entry=raw,
            kind="word",
            language="en",
            parts={"prefix": best["prefix"], "root": best["root"], "suffix": best["suffix"]},
            meta={
                "normalized": lower,
                "confidence": confidence,
                "analyzer_version": ANALYZER_VERSION,
                "rule_hits": best["rule_hits"],
                "score_breakdown": best["score_breakdown"],
                "candidates": [
                    {
                        "prefix": c["prefix"],
                        "root": c["root"],
                        "suffix": c["suffix"],
                        "score": c["score"],
                        "rule_hits": c["rule_hits"],
                    }
                    for c in candidates[:5]
                ],
                "ambiguity_delta": ambiguity_delta,
                "review_required": review_required,
            },
        )


JS_TS_KEYWORDS = {
    "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do",
    "else", "enum", "export", "extends", "false", "finally", "for", "function", "if", "import", "in",
    "instanceof", "new", "null", "return", "super", "switch", "this", "throw", "true", "try", "typeof",
    "var", "void", "while", "with", "yield", "let", "static", "implements", "interface", "package",
    "private", "protected", "public", "await", "async", "type", "namespace",
}

DOM_HINTS = {"document", "window", "element", "event", "target", "queryselector", "classname", "innerhtml", "dataset"}
VERB_PREFIX_HINTS = ("get", "set", "is", "has", "can", "should", "create", "build", "load")


class IdentifierAnalyzer:
    def supports(self, language: str, kind: str) -> bool:
        return language in ("js", "ts", "javascript", "typescript") and kind in ("identifier", "word")

    def analyze(self, text: str, language: str, kind: str) -> AnalyzedEntry:
        raw = text.strip()
        tokens = split_identifier(raw)
        normalized = [normalize_identifier_token(t) for t in tokens]
        token_meta: list[dict[str, Any]] = []
        for idx, tok in enumerate(tokens):
            low = normalized[idx]
            classes: list[str] = []
            if low in JS_TS_KEYWORDS:
                classes.append("keyword")
            if low in DOM_HINTS:
                classes.append("dom_hint")
            if tok.isdigit():
                classes.append("number")
            elif any(ch.isdigit() for ch in tok):
                classes.append("alpha_numeric")
            if tok.isupper() and len(tok) > 1 and tok.isalpha():
                classes.append("acronym")
            token_meta.append({"token": tok, "normalized": low, "index": idx, "classes": classes})
        role_hint = "verb_like_prefix" if normalized and normalized[0] in VERB_PREFIX_HINTS else None
        review_required = (len(tokens) == 0 and bool(raw))
        return AnalyzedEntry(
            entry=raw,
            kind="identifier",
            language="js" if language in ("js", "javascript") else "ts",
            parts={"tokens": tokens},
            meta={
                "style": detect_identifier_style(raw),
                "token_count": len(tokens),
                "tokens": token_meta,
                "role_hint": role_hint,
                "confidence": 0.95 if not review_required else 0.25,
                "analyzer_version": ANALYZER_VERSION,
                "review_required": review_required,
            },
        )


TAG_RE = re.compile(r"<\s*(?P<tag>[a-zA-Z][a-zA-Z0-9:-]*)\s*(?P<attrs>[^>]*)>", re.DOTALL)
ATTR_RE = re.compile(r"""(?P<name>[^\s=/>]+)\s*=\s*(?P<quote>["'])(?P<value>.*?)(?P=quote)""", re.DOTALL)


class HtmlAnalyzer:
    def supports(self, language: str, kind: str) -> bool:
        return language == "html" and kind in ("html", "tag")

    def analyze(self, text: str, language: str, kind: str) -> AnalyzedEntry:
        raw = text.strip()
        m = TAG_RE.search(raw)
        if not m:
            return AnalyzedEntry(
                entry=raw,
                kind="html",
                language="html",
                parts={"tag": None, "attrs": {}, "classTokens": [], "idTokens": [], "dataAttrTokens": {}},
                meta={"confidence": 0.2, "analyzer_version": ANALYZER_VERSION, "note": "no_tag_match", "review_required": True},
            )

        tag = m.group("tag")
        attrs_src = m.group("attrs")
        attrs: dict[str, str] = {}
        for am in ATTR_RE.finditer(attrs_src):
            attrs[am.group("name")] = am.group("value")
        class_tokens: list[str] = []
        if "class" in attrs:
            for chunk in re.split(r"\s+", attrs["class"].strip()):
                if chunk:
                    class_tokens.extend(split_identifier(chunk))
        id_tokens = split_identifier(attrs["id"].strip()) if attrs.get("id") else []
        data_attr_tokens: dict[str, list[str]] = {}
        for name, value in attrs.items():
            if name.startswith("data-"):
                data_attr_tokens[name] = split_identifier(name[5:]) + split_identifier(value)
        oversized_attrs = any(len(v) > 512 for v in attrs.values())
        return AnalyzedEntry(
            entry=raw,
            kind="html",
            language="html",
            parts={"tag": tag, "attrs": attrs, "classTokens": class_tokens, "idTokens": id_tokens, "dataAttrTokens": data_attr_tokens},
            meta={
                "confidence": 0.55 if oversized_attrs else 0.85,
                "analyzer_version": ANALYZER_VERSION,
                "attr_count": len(attrs),
                "review_required": oversized_attrs,
                "rule_hits": ["html_tag_regex"],
            },
        )


def build_registry() -> AnalyzerRegistry:
    reg = AnalyzerRegistry()
    reg.register(EnglishMorphAnalyzer())
    reg.register(IdentifierAnalyzer())
    reg.register(HtmlAnalyzer())
    return reg


SCHEMA_SQL_BASE = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS analyzed_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry TEXT NOT NULL,
  kind TEXT NOT NULL,
  language TEXT NOT NULL,
  parts_json TEXT NOT NULL,
  meta_json TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_entry ON analyzed_entries(entry);
CREATE INDEX IF NOT EXISTS idx_entries_kind_lang ON analyzed_entries(kind, language);
"""


class LexiStore:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    def close(self) -> None:
        self.conn.close()

    def _has_column(self, table: str, column: str) -> bool:
        cur = self.conn.execute(f"PRAGMA table_info({table})")
        return any(str(r["name"]) == column for r in cur.fetchall())

    def _ensure_schema_meta(self) -> None:
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_meta (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            )
            """
        )

    def _set_meta(self, key: str, value: str) -> None:
        self.conn.execute(
            "INSERT INTO schema_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

    def _get_meta(self, key: str, default: Optional[str] = None) -> Optional[str]:
        cur = self.conn.execute("SELECT value FROM schema_meta WHERE key = ?", (key,))
        row = cur.fetchone()
        return str(row["value"]) if row else default

    def _migrate_analyzed_entries_columns(self) -> None:
        add_columns = [
            ("entry_hash", "TEXT"),
            ("analyzer_version", "TEXT"),
            ("confidence", "REAL"),
            ("status", "TEXT"),
            ("source_type", "TEXT"),
            ("run_id", "TEXT"),
            ("updated_at_utc", "TEXT"),
        ]
        for col, typ in add_columns:
            if not self._has_column("analyzed_entries", col):
                self.conn.execute(f"ALTER TABLE analyzed_entries ADD COLUMN {col} {typ}")
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_entries_status ON analyzed_entries(status)")
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_entries_confidence ON analyzed_entries(confidence)")
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_entries_entry_hash ON analyzed_entries(entry_hash)")
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_entries_run_id ON analyzed_entries(run_id)")

    def _create_v2_tables(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS analyzed_parts_index (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              entry_id INTEGER NOT NULL,
              part_type TEXT NOT NULL,
              part_value TEXT NOT NULL,
              part_norm TEXT NOT NULL,
              part_order INTEGER NULL,
              language TEXT NOT NULL,
              kind TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_parts_entry_id ON analyzed_parts_index(entry_id);
            CREATE INDEX IF NOT EXISTS idx_parts_type_norm ON analyzed_parts_index(part_type, part_norm);
            CREATE INDEX IF NOT EXISTS idx_parts_lang_kind_type ON analyzed_parts_index(language, kind, part_type);

            CREATE TABLE IF NOT EXISTS analyzed_provenance (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              entry_id INTEGER NOT NULL,
              source_path TEXT,
              source_kind TEXT,
              workspace_root TEXT NULL,
              line_start INTEGER NULL,
              line_end INTEGER NULL,
              col_start INTEGER NULL,
              col_end INTEGER NULL,
              snippet TEXT NULL,
              ingest_mode TEXT,
              created_at_utc TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_prov_entry_id ON analyzed_provenance(entry_id);
            CREATE INDEX IF NOT EXISTS idx_prov_source_path ON analyzed_provenance(source_path);
            CREATE INDEX IF NOT EXISTS idx_prov_kind_path ON analyzed_provenance(source_kind, source_path);

            CREATE TABLE IF NOT EXISTS ingest_runs (
              run_id TEXT PRIMARY KEY,
              started_at_utc TEXT NOT NULL,
              finished_at_utc TEXT NULL,
              status TEXT NOT NULL,
              requested_by TEXT NOT NULL,
              root_path TEXT NOT NULL,
              config_json TEXT NOT NULL,
              stats_json TEXT NOT NULL,
              error_json TEXT NULL
            );

            CREATE TABLE IF NOT EXISTS review_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              entry_id INTEGER NOT NULL,
              action TEXT NOT NULL,
              reason TEXT,
              actor TEXT NOT NULL,
              notes TEXT,
              created_at_utc TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_review_entry_id ON review_events(entry_id);
            CREATE INDEX IF NOT EXISTS idx_review_action_created ON review_events(action, created_at_utc);
            """
        )
        try:
            self.conn.execute(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS analyzed_entries_fts
                USING fts5(entry, parts_json, meta_json, content='')
                """
            )
        except sqlite3.OperationalError:
            pass

    def _iter_part_index_rows(self, e: AnalyzedEntry) -> Iterable[tuple[str, str, str, Optional[int]]]:
        parts = e.parts if isinstance(e.parts, dict) else {}
        if e.kind == "word":
            for part_type in ("prefix", "root", "suffix"):
                value = parts.get(part_type)
                if isinstance(value, str) and value.strip():
                    yield (part_type, value, value.strip("-").lower(), None)
        elif e.kind == "identifier":
            tokens = parts.get("tokens")
            if isinstance(tokens, list):
                for i, tok in enumerate(tokens):
                    if isinstance(tok, str) and tok:
                        yield ("token", tok, normalize_identifier_token(tok), i)
        elif e.kind == "html":
            tag = parts.get("tag")
            if isinstance(tag, str) and tag:
                yield ("tag", tag, tag.lower(), None)
            attrs = parts.get("attrs")
            if isinstance(attrs, dict):
                for k, v in attrs.items():
                    if isinstance(k, str):
                        yield ("attr_name", k, k.lower(), None)
                    if isinstance(v, str) and v:
                        yield ("attr_value", v[:512], normalize_text(v)[:256], None)
            for key, ptype in (("classTokens", "class_token"), ("idTokens", "id_token")):
                toks = parts.get(key)
                if isinstance(toks, list):
                    for i, tok in enumerate(toks):
                        if isinstance(tok, str) and tok:
                            yield (ptype, tok, normalize_identifier_token(tok), i)
            dat = parts.get("dataAttrTokens")
            if isinstance(dat, dict):
                for _name, toks in dat.items():
                    if isinstance(toks, list):
                        for i, tok in enumerate(toks):
                            if isinstance(tok, str) and tok:
                                yield ("data_attr_token", tok, normalize_identifier_token(tok), i)

    def _replace_parts_index(self, entry_id: int, e: AnalyzedEntry) -> None:
        self.conn.execute("DELETE FROM analyzed_parts_index WHERE entry_id = ?", (entry_id,))
        rows = list(self._iter_part_index_rows(e))
        if not rows:
            return
        self.conn.executemany(
            """
            INSERT INTO analyzed_parts_index(entry_id, part_type, part_value, part_norm, part_order, language, kind)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [(entry_id, t, v, n, o, e.language, e.kind) for (t, v, n, o) in rows],
        )

    def _insert_provenance(self, entry_id: int, provenance: ProvenanceRecord | dict[str, Any]) -> None:
        p = provenance if isinstance(provenance, dict) else dataclasses.asdict(provenance)
        self.conn.execute(
            """
            INSERT INTO analyzed_provenance(
              entry_id, source_path, source_kind, workspace_root, line_start, line_end,
              col_start, col_end, snippet, ingest_mode, created_at_utc
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_id,
                p.get("source_path"),
                p.get("source_kind", "text"),
                p.get("workspace_root"),
                p.get("line_start"),
                p.get("line_end"),
                p.get("col_start"),
                p.get("col_end"),
                (str(p.get("snippet"))[:500] if p.get("snippet") is not None else None),
                p.get("ingest_mode", "on_demand"),
                utc_now_iso(),
            ),
        )

    def _append_review_event(self, entry_id: int, action: str, *, reason: str | None = None, actor: str = "system", notes: str | None = None) -> None:
        self.conn.execute(
            """
            INSERT INTO review_events(entry_id, action, reason, actor, notes, created_at_utc)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (entry_id, action, reason, actor, notes, utc_now_iso()),
        )

    def _derive_status(self, meta: dict[str, Any], force_review: bool) -> str:
        if force_review or bool(meta.get("review_required", False)):
            return "needs_review"
        return "needs_review" if float(meta.get("confidence", 0.0) or 0.0) < DEFAULT_REVIEW_CONFIDENCE else "auto_accepted"

    def _entry_hash(self, e: AnalyzedEntry) -> str:
        normalized = e.meta.get("normalized") if isinstance(e.meta, dict) else None
        if not normalized:
            normalized = normalize_text(e.entry)
        return stable_hash_obj({"entry": e.entry, "kind": e.kind, "language": e.language, "normalized": normalized})

    def _backfill_v2_columns(self) -> None:
        cur = self.conn.execute(
            """
            SELECT id, entry, kind, language, parts_json, meta_json, created_at_utc
            FROM analyzed_entries
            WHERE entry_hash IS NULL OR analyzer_version IS NULL OR confidence IS NULL OR status IS NULL
            """
        )
        for r in cur.fetchall():
            try:
                parts = json.loads(r["parts_json"])
            except Exception:
                parts = {}
            try:
                meta = json.loads(r["meta_json"])
            except Exception:
                meta = {}
            normalized = meta.get("normalized") or normalize_text(str(r["entry"]))
            entry_hash = stable_hash_obj({"entry": r["entry"], "kind": r["kind"], "language": r["language"], "normalized": normalized})
            confidence = float(meta.get("confidence", 0.5) or 0.0)
            status = "needs_review" if confidence < DEFAULT_REVIEW_CONFIDENCE else "auto_accepted"
            self.conn.execute(
                """
                UPDATE analyzed_entries
                SET entry_hash = ?, analyzer_version = COALESCE(analyzer_version, ?),
                    confidence = ?, status = COALESCE(status, ?),
                    source_type = COALESCE(source_type, 'manual'),
                    updated_at_utc = COALESCE(updated_at_utc, created_at_utc)
                WHERE id = ?
                """,
                (entry_hash, ANALYZER_VERSION, confidence, status, int(r["id"])),
            )
            fake = AnalyzedEntry(entry=str(r["entry"]), kind=str(r["kind"]), language=str(r["language"]), parts=parts, meta=meta, created_at_utc=str(r["created_at_utc"]))
            self._replace_parts_index(int(r["id"]), fake)

    def init(self) -> None:
        self.conn.executescript(SCHEMA_SQL_BASE)
        self._ensure_schema_meta()
        self._migrate_analyzed_entries_columns()
        self._create_v2_tables()
        self._backfill_v2_columns()
        self._set_meta("schema_version", SCHEMA_VERSION)
        self._set_meta("analyzer_version", ANALYZER_VERSION)
        self._set_meta("last_migrated_at_utc", utc_now_iso())
        self.conn.commit()

    def schema_version(self) -> str:
        return self._get_meta("schema_version", "1") or "1"

    def analyzer_version(self) -> str:
        return self._get_meta("analyzer_version", ANALYZER_VERSION) or ANALYZER_VERSION

    def stats(self) -> dict[str, Any]:
        total = int(self.conn.execute("SELECT COUNT(*) AS n FROM analyzed_entries").fetchone()["n"])
        rows = self.conn.execute("SELECT status, COUNT(*) AS n FROM analyzed_entries GROUP BY status ORDER BY n DESC").fetchall()
        return {"entries": total, "by_status": {str(r["status"]): int(r["n"]) for r in rows}}

    def insert(
        self,
        e: AnalyzedEntry,
        provenance: ProvenanceRecord | dict[str, Any] | None = None,
        *,
        source_type: str = "manual",
        run_id: str | None = None,
        force_review: bool = False,
        tags: list[str] | None = None,
    ) -> int:
        meta = dict(e.meta)
        meta.setdefault("analyzer_version", ANALYZER_VERSION)
        if tags:
            meta["tags"] = sorted({str(t) for t in tags if str(t).strip()})
        confidence = float(meta.get("confidence", 0.0) or 0.0)
        status = self._derive_status(meta, force_review=force_review)
        if status == "needs_review":
            meta["review_required"] = True
        cur = self.conn.execute(
            """
            INSERT INTO analyzed_entries(
              entry, kind, language, parts_json, meta_json, created_at_utc,
              entry_hash, analyzer_version, confidence, status, source_type, run_id, updated_at_utc
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                e.entry,
                e.kind,
                e.language,
                stable_json(e.parts),
                stable_json(meta),
                e.created_at_utc,
                self._entry_hash(e),
                str(meta.get("analyzer_version", ANALYZER_VERSION)),
                confidence,
                status,
                source_type,
                run_id,
                utc_now_iso(),
            ),
        )
        entry_id = int(cur.lastrowid)
        self._replace_parts_index(entry_id, AnalyzedEntry(e.entry, e.kind, e.language, e.parts, meta, e.created_at_utc))
        if provenance:
            self._insert_provenance(entry_id, provenance)
        if status == "needs_review":
            self._append_review_event(entry_id, "flag_auto", reason="force_review" if force_review else "low_confidence_or_ambiguity")
        try:
            self.conn.execute(
                "INSERT INTO analyzed_entries_fts(rowid, entry, parts_json, meta_json) VALUES (?, ?, ?, ?)",
                (entry_id, e.entry, stable_json(e.parts), stable_json(meta)),
            )
        except sqlite3.OperationalError:
            pass
        self.conn.commit()
        return entry_id

    def _row_to_entry_dict(self, r: sqlite3.Row, include_provenance: bool = False) -> dict[str, Any]:
        out = {
            "id": r["id"],
            "entry": r["entry"],
            "kind": r["kind"],
            "language": r["language"],
            "parts": json.loads(r["parts_json"]),
            "meta": json.loads(r["meta_json"]),
            "created_at_utc": r["created_at_utc"],
            "entry_hash": r["entry_hash"] if "entry_hash" in r.keys() else None,
            "analyzer_version": r["analyzer_version"] if "analyzer_version" in r.keys() else None,
            "confidence": r["confidence"] if "confidence" in r.keys() else None,
            "status": r["status"] if "status" in r.keys() else None,
            "source_type": r["source_type"] if "source_type" in r.keys() else None,
            "run_id": r["run_id"] if "run_id" in r.keys() else None,
            "updated_at_utc": r["updated_at_utc"] if "updated_at_utc" in r.keys() else None,
        }
        if include_provenance:
            out["provenance"] = self.get_provenance_for_entry(int(r["id"]))
        return out

    def get_provenance_for_entry(self, entry_id: int) -> list[dict[str, Any]]:
        cur = self.conn.execute(
            """
            SELECT source_path, source_kind, workspace_root, line_start, line_end, col_start, col_end, snippet, ingest_mode, created_at_utc
            FROM analyzed_provenance
            WHERE entry_id = ?
            ORDER BY id ASC
            """,
            (entry_id,),
        )
        return [dict(r) for r in cur.fetchall()]

    def query_contains(
        self,
        text: str,
        limit: int = 50,
        *,
        language: str | None = None,
        kind: str | None = None,
        status: str | None = None,
        part_type: str | None = None,
    ) -> list[dict[str, Any]]:
        limit = clamp_int(int(limit), 1, 500)
        sql = ["SELECT DISTINCT e.* FROM analyzed_entries e"]
        params: list[Any] = []
        if part_type:
            sql.append("LEFT JOIN analyzed_parts_index p ON p.entry_id = e.id")
        like = f"%{text}%"
        where: list[str] = []
        if part_type:
            where.append("(e.entry LIKE ? OR e.parts_json LIKE ? OR e.meta_json LIKE ? OR (p.part_type = ? AND p.part_norm LIKE ?))")
            params.extend([like, like, like, part_type, like.lower()])
        else:
            where.append("(e.entry LIKE ? OR e.parts_json LIKE ? OR e.meta_json LIKE ?)")
            params.extend([like, like, like])
        if language:
            where.append("e.language = ?")
            params.append(language)
        if kind:
            where.append("e.kind = ?")
            params.append(kind)
        if status:
            where.append("e.status = ?")
            params.append(status)
        if where:
            sql.append("WHERE " + " AND ".join(where))
        sql.append("ORDER BY e.id DESC LIMIT ?")
        params.append(limit)
        cur = self.conn.execute("\n".join(sql), params)
        return [self._row_to_entry_dict(r) for r in cur.fetchall()]

    def search(
        self,
        q: str,
        *,
        language: str | None = None,
        kind: str | None = None,
        status: str | None = None,
        part_type: str | None = None,
        limit: int = 25,
        include_provenance: bool = False,
        include_parts: bool = True,
    ) -> list[dict[str, Any]]:
        _ = include_parts
        limit = clamp_int(int(limit), 1, 200)
        qn = q.strip()
        if not qn:
            return []
        qlow = qn.lower()
        like = f"%{qn}%"
        sql = """
            SELECT DISTINCT e.*
            FROM analyzed_entries e
            LEFT JOIN analyzed_parts_index p ON p.entry_id = e.id
            WHERE (e.entry LIKE ? OR e.parts_json LIKE ? OR e.meta_json LIKE ? OR p.part_norm LIKE ?)
        """
        params: list[Any] = [like, like, like, f"%{qlow}%"]
        if language:
            sql += " AND e.language = ?"
            params.append(language)
        if kind:
            sql += " AND e.kind = ?"
            params.append(kind)
        if status:
            sql += " AND e.status = ?"
            params.append(status)
        if part_type:
            sql += " AND p.part_type = ?"
            params.append(part_type)
        sql += " ORDER BY e.id DESC LIMIT ?"
        params.append(max(limit * 5, 50))
        rows = self.conn.execute(sql, params).fetchall()

        def score_row(r: sqlite3.Row) -> tuple[int, float, int]:
            base = 0
            entry = str(r["entry"])
            if entry == qn:
                base += 400
            if entry.lower() == qlow:
                base += 300
            if entry.lower().startswith(qlow):
                base += 120
            if qlow in entry.lower():
                base += 60
            pcur = self.conn.execute("SELECT part_type, part_norm FROM analyzed_parts_index WHERE entry_id = ?", (int(r["id"]),))
            for pr in pcur.fetchall():
                pnorm = str(pr["part_norm"])
                ptype = str(pr["part_type"])
                if pnorm == qlow:
                    base += 250
                elif pnorm.startswith(qlow):
                    base += 100
                elif qlow in pnorm:
                    base += 40
                if part_type and ptype == part_type:
                    base += 5
            conf = float(r["confidence"] or 0.0) if "confidence" in r.keys() else 0.0
            return (base, conf, int(r["id"]))

        ranked = sorted(rows, key=score_row, reverse=True)[:limit]
        return [self._row_to_entry_dict(r, include_provenance=include_provenance) for r in ranked]

    def get_entry_detail(self, entry_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM analyzed_entries WHERE id = ?", (entry_id,)).fetchone()
        if not row:
            return None
        out = self._row_to_entry_dict(row, include_provenance=True)
        rev = self.conn.execute(
            "SELECT id, action, reason, actor, notes, created_at_utc FROM review_events WHERE entry_id = ? ORDER BY id ASC",
            (entry_id,),
        ).fetchall()
        out["review_events"] = [dict(r) for r in rev]
        return out

    def list_review_queue(
        self,
        *,
        language: str | None = None,
        kind: str | None = None,
        limit: int = 50,
        min_confidence: float | None = None,
        status: str = "needs_review",
    ) -> list[dict[str, Any]]:
        sql = "SELECT * FROM analyzed_entries WHERE status = ?"
        params: list[Any] = [status]
        if language:
            sql += " AND language = ?"
            params.append(language)
        if kind:
            sql += " AND kind = ?"
            params.append(kind)
        if min_confidence is not None:
            sql += " AND confidence <= ?"
            params.append(float(min_confidence))
        sql += " ORDER BY confidence ASC, id DESC LIMIT ?"
        params.append(clamp_int(int(limit), 1, 500))
        rows = self.conn.execute(sql, params).fetchall()
        return [self._row_to_entry_dict(r, include_provenance=True) for r in rows]

    def review_entry(self, entry_id: int, *, action: str, actor: str = "user", reason: str | None = None, notes: str | None = None) -> Optional[dict[str, Any]]:
        row = self.conn.execute("SELECT id, status FROM analyzed_entries WHERE id = ?", (entry_id,)).fetchone()
        if not row:
            return None
        if action not in {"approve", "reject", "note"}:
            raise ValueError("action must be approve|reject|note")
        if action == "approve":
            self.conn.execute("UPDATE analyzed_entries SET status = ?, updated_at_utc = ? WHERE id = ?", ("reviewed_approved", utc_now_iso(), entry_id))
        elif action == "reject":
            self.conn.execute("UPDATE analyzed_entries SET status = ?, updated_at_utc = ? WHERE id = ?", ("reviewed_rejected", utc_now_iso(), entry_id))
        self._append_review_event(entry_id, action, reason=reason, actor=actor, notes=notes)
        self.conn.commit()
        return self.get_entry_detail(entry_id)

    def create_ingest_run(self, *, requested_by: str, root_path: str, config: dict[str, Any]) -> str:
        run_id = f"ing_{uuid.uuid4().hex[:16]}"
        self.conn.execute(
            """
            INSERT INTO ingest_runs(run_id, started_at_utc, finished_at_utc, status, requested_by, root_path, config_json, stats_json, error_json)
            VALUES (?, ?, NULL, 'running', ?, ?, ?, ?, NULL)
            """,
            (run_id, utc_now_iso(), requested_by, root_path, stable_json(config), stable_json({})),
        )
        self.conn.commit()
        return run_id

    def finish_ingest_run(self, run_id: str, *, status: str, stats: dict[str, Any], error: dict[str, Any] | None = None) -> None:
        self.conn.execute(
            "UPDATE ingest_runs SET finished_at_utc = ?, status = ?, stats_json = ?, error_json = ? WHERE run_id = ?",
            (utc_now_iso(), status, stable_json(stats), stable_json(error) if error else None, run_id),
        )
        self.conn.commit()

    def get_ingest_run(self, run_id: str) -> Optional[dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM ingest_runs WHERE run_id = ?", (run_id,)).fetchone()
        if not row:
            return None
        return {
            "run_id": row["run_id"],
            "started_at_utc": row["started_at_utc"],
            "finished_at_utc": row["finished_at_utc"],
            "status": row["status"],
            "requested_by": row["requested_by"],
            "root_path": row["root_path"],
            "config": json.loads(row["config_json"]),
            "stats": json.loads(row["stats_json"]),
            "error": json.loads(row["error_json"]) if row["error_json"] else None,
        }

    def export_jsonl(self, out_path: str) -> int:
        cur = self.conn.execute("SELECT * FROM analyzed_entries ORDER BY id ASC")
        count = 0
        with open(out_path, "w", encoding="utf-8") as f:
            for row in cur.fetchall():
                f.write(json.dumps(self._row_to_entry_dict(row), ensure_ascii=False) + "\n")
                count += 1
        return count


def _detect_ingest_mode_from_ext(path: Path) -> str | None:
    ext = path.suffix.lower()
    if ext in {".ts", ".tsx"}:
        return "ts"
    if ext in {".js", ".jsx"}:
        return "js"
    if ext in {".html", ".htm"}:
        return "html"
    if ext in {".md", ".txt"}:
        return "text"
    return None


def _iter_files_bounded(
    root_path: Path,
    *,
    include_globs: Sequence[str],
    exclude_globs: Sequence[str],
    max_files: int,
    max_file_bytes: int,
) -> Iterable[Path]:
    count = 0
    for p in root_path.rglob("*"):
        if count >= max_files:
            break
        if not p.is_file():
            continue
        rel = p.relative_to(root_path).as_posix()
        if include_globs and not any(fnmatch.fnmatch(rel, pat) for pat in include_globs):
            continue
        if exclude_globs and any(fnmatch.fnmatch(rel, pat) for pat in exclude_globs):
            continue
        try:
            if p.stat().st_size > max_file_bytes:
                continue
        except OSError:
            continue
        count += 1
        yield p


def ingest_files(
    *,
    store: LexiStore,
    registry: AnalyzerRegistry,
    root_path: str,
    include_globs: Sequence[str] | None = None,
    exclude_globs: Sequence[str] | None = None,
    languages: Sequence[str] | None = None,
    max_files: int = 500,
    max_file_bytes: int = 256 * 1024,
    store_results: bool = True,
    extract_words: bool = True,
    extract_identifiers: bool = True,
    extract_html: bool = True,
    record_provenance: bool = True,
    dry_run: bool = False,
    requested_by: str = "cli",
) -> dict[str, Any]:
    root = Path(root_path).resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError(f"root_path is not a directory: {root_path}")

    include_globs = list(include_globs or ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.html", "**/*.htm", "**/*.md", "**/*.txt"])
    exclude_globs = list(
        exclude_globs
        or [
            "node_modules/**",
            "**/node_modules/**",
            "dist/**",
            "**/dist/**",
            "build/**",
            "**/build/**",
            ".git/**",
            "**/.git/**",
            ".venv/**",
            "**/.venv/**",
            "__pycache__/**",
            "**/__pycache__/**",
        ]
    )
    languages_set = {str(x).lower() for x in (languages or ["en", "js", "ts", "html"])}
    cfg = {
        "root_path": str(root),
        "include_globs": include_globs,
        "exclude_globs": exclude_globs,
        "languages": sorted(languages_set),
        "max_files": int(max_files),
        "max_file_bytes": int(max_file_bytes),
        "store": bool(store_results),
        "extract_words": bool(extract_words),
        "extract_identifiers": bool(extract_identifiers),
        "extract_html": bool(extract_html),
        "record_provenance": bool(record_provenance),
        "dry_run": bool(dry_run),
    }
    run_id = store.create_ingest_run(requested_by=requested_by, root_path=str(root), config=cfg)
    stats: dict[str, Any] = {
        "files_scanned": 0,
        "files_processed": 0,
        "candidates_seen": 0,
        "entries_analyzed": 0,
        "entries_stored": 0,
        "entries_flagged": 0,
        "skipped_duplicates_within_file": 0,
        "by_language_kind": {},
        "errors": [],
    }

    try:
        for file_path in _iter_files_bounded(root, include_globs=include_globs, exclude_globs=exclude_globs, max_files=max_files, max_file_bytes=max_file_bytes):
            stats["files_scanned"] += 1
            mode = _detect_ingest_mode_from_ext(file_path)
            if not mode:
                continue
            if mode == "text" and "en" not in languages_set:
                continue
            if mode in {"js", "ts", "html"} and mode not in languages_set:
                continue

            try:
                text = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception as e:
                stats["errors"].append({"path": str(file_path), "error": str(e)})
                continue
            stats["files_processed"] += 1
            seen_in_file: set[tuple[str, str, str, int, int]] = set()
            rel_path = str(file_path.relative_to(root))

            def _handle_candidate(entry_text: str, lang: str, kind: str, start: int, end: int) -> None:
                stats["candidates_seen"] += 1
                key = (entry_text, lang, kind, start, end)
                if key in seen_in_file:
                    stats["skipped_duplicates_within_file"] += 1
                    return
                seen_in_file.add(key)
                analyzed = registry.analyze(text=entry_text, language=lang, kind=kind)
                stats["entries_analyzed"] += 1
                bucket = f"{analyzed.language}:{analyzed.kind}"
                stats["by_language_kind"][bucket] = int(stats["by_language_kind"].get(bucket, 0)) + 1
                if bool(analyzed.meta.get("review_required", False)):
                    stats["entries_flagged"] += 1
                if store_results and not dry_run:
                    prov = None
                    if record_provenance:
                        ls, cs = line_col_from_offset(text, start)
                        le, ce = line_col_from_offset(text, max(start, end - 1))
                        prov = ProvenanceRecord(
                            source_path=rel_path,
                            source_kind="file",
                            workspace_root=str(root),
                            line_start=ls,
                            line_end=le,
                            col_start=cs,
                            col_end=ce,
                            snippet=text[max(0, start - 40): min(len(text), end + 40)],
                            ingest_mode="batch",
                        )
                    store.insert(analyzed, prov, source_type="batch", run_id=run_id)
                    stats["entries_stored"] += 1

            if mode == "text" and extract_words:
                for word, start, end in extract_words_with_spans(text):
                    _handle_candidate(word, "en", "word", start, end)

            if mode in {"js", "ts"} and extract_identifiers:
                for ident, start, end in extract_identifiers_with_spans(text):
                    _handle_candidate(ident, mode, "identifier", start, end)

            if mode == "html" and extract_html:
                for snippet, start, end in extract_html_tags_with_spans(text):
                    _handle_candidate(snippet, "html", "html", start, end)
                if extract_words and "en" in languages_set:
                    for word, start, end in extract_words_with_spans(text):
                        _handle_candidate(word, "en", "word", start, end)

        store.finish_ingest_run(run_id, status="ok", stats=stats)
        return {"ok": True, "run_id": run_id, "status": "ok", "stats": stats}
    except Exception as e:
        store.finish_ingest_run(run_id, status="error", stats=stats, error={"message": str(e)})
        raise


def _default_db_path() -> str:
    return os.path.join(os.getcwd(), "leximorph.sqlite")


def cmd_init(args: argparse.Namespace) -> int:
    store = LexiStore(args.db)
    try:
        store.init()
        print(json.dumps({"ok": True, "db": store.db_path, "schema_version": store.schema_version(), "analyzer_version": store.analyzer_version(), "stats": store.stats()}, ensure_ascii=False, indent=2))
        return 0
    finally:
        store.close()


def cmd_analyze(args: argparse.Namespace) -> int:
    reg = build_registry()
    store = LexiStore(args.db)
    try:
        store.init()
        analyzed = reg.analyze(text=args.text, language=args.lang, kind=args.kind)
        out_obj = dataclasses.asdict(analyzed)
        stored_id: int | None = None
        status: str | None = None
        if args.store:
            provenance = None
            if args.source_path:
                provenance = ProvenanceRecord(
                    source_path=args.source_path,
                    source_kind=args.source_kind,
                    workspace_root=args.workspace_root,
                    line_start=args.line_start,
                    line_end=args.line_end or args.line_start,
                    col_start=args.col_start,
                    col_end=args.col_end,
                    snippet=args.snippet,
                    ingest_mode="on_demand",
                )
            stored_id = store.insert(analyzed, provenance, source_type=args.source_type, force_review=args.force_review, tags=args.tags or None)
            detail = store.get_entry_detail(stored_id)
            status = detail.get("status") if detail else None
        print(json.dumps({**out_obj, "stored": bool(args.store), "id": stored_id, "status": status, "schema_version": store.schema_version()}, ensure_ascii=False, indent=2))
        return 0
    finally:
        store.close()


def cmd_query(args: argparse.Namespace) -> int:
    store = LexiStore(args.db)
    try:
        store.init()
        rows = store.query_contains(args.contains, limit=args.limit, language=args.language, kind=args.kind, status=args.status, part_type=args.part_type)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    finally:
        store.close()


def cmd_search(args: argparse.Namespace) -> int:
    store = LexiStore(args.db)
    try:
        store.init()
        rows = store.search(args.q, language=args.language, kind=args.kind, status=args.status, part_type=args.part_type, limit=args.limit, include_provenance=args.include_provenance)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    finally:
        store.close()


def cmd_entry(args: argparse.Namespace) -> int:
    store = LexiStore(args.db)
    try:
        store.init()
        detail = store.get_entry_detail(args.id)
        if detail is None:
            print(json.dumps({"ok": False, "error": "not_found", "id": args.id}, indent=2))
            return 1
        print(json.dumps(detail, ensure_ascii=False, indent=2))
        return 0
    finally:
        store.close()


def cmd_review_queue(args: argparse.Namespace) -> int:
    store = LexiStore(args.db)
    try:
        store.init()
        rows = store.list_review_queue(language=args.language, kind=args.kind, limit=args.limit, min_confidence=args.min_confidence, status=args.status)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    finally:
        store.close()


def cmd_review(args: argparse.Namespace) -> int:
    store = LexiStore(args.db)
    try:
        store.init()
        detail = store.review_entry(args.id, action=args.action, actor=args.actor, reason=args.reason, notes=args.notes)
        if detail is None:
            print(json.dumps({"ok": False, "error": "not_found", "id": args.id}, indent=2))
            return 1
        print(json.dumps(detail, ensure_ascii=False, indent=2))
        return 0
    finally:
        store.close()


def cmd_export(args: argparse.Namespace) -> int:
    store = LexiStore(args.db)
    try:
        store.init()
        n = store.export_jsonl(args.out)
        print(json.dumps({"ok": True, "exported": n, "out": args.out}, indent=2))
        return 0
    finally:
        store.close()


def cmd_ingest(args: argparse.Namespace) -> int:
    reg = build_registry()
    store = LexiStore(args.db)
    try:
        store.init()
        out = ingest_files(
            store=store,
            registry=reg,
            root_path=args.root_path,
            include_globs=args.include_globs or None,
            exclude_globs=args.exclude_globs or None,
            languages=args.languages or None,
            max_files=args.max_files,
            max_file_bytes=args.max_file_bytes,
            store_results=not args.no_store,
            extract_words=not args.no_words,
            extract_identifiers=not args.no_identifiers,
            extract_html=not args.no_html,
            record_provenance=not args.no_provenance,
            dry_run=args.dry_run,
            requested_by="cli",
        )
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0
    finally:
        store.close()


def cmd_ingest_run(args: argparse.Namespace) -> int:
    store = LexiStore(args.db)
    try:
        store.init()
        run = store.get_ingest_run(args.run_id)
        if not run:
            print(json.dumps({"ok": False, "error": "not_found", "run_id": args.run_id}, indent=2))
            return 1
        print(json.dumps(run, ensure_ascii=False, indent=2))
        return 0
    finally:
        store.close()


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="leximorph", description="Automated word + code analysis system (v2)")
    p.add_argument("--db", default=_default_db_path(), help="Path to SQLite DB")
    sub = p.add_subparsers(dest="cmd", required=True)

    s_init = sub.add_parser("init", help="Initialize or migrate the SQLite database")
    s_init.set_defaults(func=cmd_init)

    s_an = sub.add_parser("analyze", help="Analyze text and optionally store")
    s_an.add_argument("--lang", required=True)
    s_an.add_argument("--kind", required=True)
    s_an.add_argument("--text", required=True)
    s_an.add_argument("--store", action="store_true")
    s_an.add_argument("--force-review", action="store_true")
    s_an.add_argument("--source-type", default="manual", choices=["manual", "batch", "ide", "api"])
    s_an.add_argument("--source-kind", default="text", choices=["text", "file", "http"])
    s_an.add_argument("--source-path")
    s_an.add_argument("--workspace-root")
    s_an.add_argument("--line-start", type=int)
    s_an.add_argument("--line-end", type=int)
    s_an.add_argument("--col-start", type=int)
    s_an.add_argument("--col-end", type=int)
    s_an.add_argument("--snippet")
    s_an.add_argument("--tag", dest="tags", action="append")
    s_an.set_defaults(func=cmd_analyze)

    s_q = sub.add_parser("query", help="Substring query (compat)")
    s_q.add_argument("--contains", required=True)
    s_q.add_argument("--limit", type=int, default=50)
    s_q.add_argument("--language")
    s_q.add_argument("--kind")
    s_q.add_argument("--status")
    s_q.add_argument("--part-type")
    s_q.set_defaults(func=cmd_query)

    s_search = sub.add_parser("search", help="Ranked search")
    s_search.add_argument("--q", required=True)
    s_search.add_argument("--limit", type=int, default=25)
    s_search.add_argument("--language")
    s_search.add_argument("--kind")
    s_search.add_argument("--status")
    s_search.add_argument("--part-type")
    s_search.add_argument("--include-provenance", action="store_true")
    s_search.set_defaults(func=cmd_search)

    s_entry = sub.add_parser("entry", help="Fetch entry detail by id")
    s_entry.add_argument("--id", type=int, required=True)
    s_entry.set_defaults(func=cmd_entry)

    s_rq = sub.add_parser("review-queue", help="List review queue")
    s_rq.add_argument("--limit", type=int, default=50)
    s_rq.add_argument("--language")
    s_rq.add_argument("--kind")
    s_rq.add_argument("--status", default="needs_review")
    s_rq.add_argument("--min-confidence", type=float)
    s_rq.set_defaults(func=cmd_review_queue)

    s_rev = sub.add_parser("review", help="Review an entry")
    s_rev.add_argument("--id", type=int, required=True)
    s_rev.add_argument("--action", required=True, choices=["approve", "reject", "note"])
    s_rev.add_argument("--actor", default="user")
    s_rev.add_argument("--reason")
    s_rev.add_argument("--notes")
    s_rev.set_defaults(func=cmd_review)

    s_ing = sub.add_parser("ingest", help="Batch ingest files")
    s_ing.add_argument("--root-path", required=True)
    s_ing.add_argument("--include-glob", dest="include_globs", action="append")
    s_ing.add_argument("--exclude-glob", dest="exclude_globs", action="append")
    s_ing.add_argument("--language", dest="languages", action="append")
    s_ing.add_argument("--max-files", type=int, default=500)
    s_ing.add_argument("--max-file-bytes", type=int, default=256 * 1024)
    s_ing.add_argument("--dry-run", action="store_true")
    s_ing.add_argument("--no-store", action="store_true")
    s_ing.add_argument("--no-words", action="store_true")
    s_ing.add_argument("--no-identifiers", action="store_true")
    s_ing.add_argument("--no-html", action="store_true")
    s_ing.add_argument("--no-provenance", action="store_true")
    s_ing.set_defaults(func=cmd_ingest)

    s_run = sub.add_parser("ingest-run", help="Get ingest run summary")
    s_run.add_argument("--run-id", required=True)
    s_run.set_defaults(func=cmd_ingest_run)

    s_ex = sub.add_parser("export", help="Export entries to JSONL")
    s_ex.add_argument("--out", required=True)
    s_ex.set_defaults(func=cmd_export)

    args = p.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
