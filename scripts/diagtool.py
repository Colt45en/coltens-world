#!/usr/bin/env python3
"""
diagtool.py — Parse C++ compiler diagnostics and Python tracebacks,
then emit:
  - SARIF 2.1.0 (GitHub code scanning compatible)
  - Append-only ledger NDJSON with content-addressed events (sha256)

No third-party deps (stdlib only).

Examples:
  # C++ build log -> SARIF + ledger
  ninja -C build 2>&1 | python diagtool.py --kind cpp --emit sarif --emit ledger \
    --srcroot "$GITHUB_WORKSPACE" --sarif-out results.sarif.json --ledger-out ledger.ndjson

  # Python traceback -> SARIF
  python -m pytest 2>&1 | python diagtool.py --kind python --emit sarif --sarif-out results.sarif.json

  # Auto-detect kind
  cat build.log | python diagtool.py --kind auto --emit sarif --emit ledger

Notes for GitHub:
  - SARIF severity must be one of: error|warning|note
  - Keep SARIF under size limits (10MB gz) by limiting results if needed.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as _dt
import hashlib
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

SARIF_SCHEMA = "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json"
SARIF_VERSION = "2.1.0"
TOOL_NAME_DEFAULT = "diagtool"
TOOL_VERSION_DEFAULT = "1.0.0"


# -------------------- Core models --------------------

@dataclasses.dataclass
class StackFrame:
    path: str
    line: int
    func: Optional[str] = None


@dataclasses.dataclass
class Diagnostic:
    severity: str  # error|warning|note|info
    path: Optional[str]
    line: Optional[int]
    col: Optional[int]
    code: Optional[str]
    message: str
    raw: str
    related: List[str] = dataclasses.field(default_factory=list)
    stack: List[StackFrame] = dataclasses.field(default_factory=list)

    def to_normalized(self) -> Dict[str, Any]:
        return {
            "severity": self.severity,
            "path": self.path,
            "line": self.line,
            "col": self.col,
            "code": self.code,
            "message": self.message,
            "raw": self.raw,
            "related": self.related,
            "stack": [{"path": f.path, "line": f.line, "func": f.func} for f in self.stack],
        }


def _norm_sev(sev: str) -> str:
    s = sev.strip().lower()
    if s == "fatal error":
        return "error"
    if s in ("error", "warning", "note", "info"):
        return s
    return "info"


def _sev_to_sarif_level(sev: str) -> str:
    # GitHub expects: error|warning|note
    if sev == "error":
        return "error"
    if sev == "warning":
        return "warning"
    # note + info collapse to note (GitHub only has 3 levels)
    return "note"


# -------------------- C++ parsing --------------------

GCC_CLANG_RE = re.compile(
    r"""
    ^(?P<path>(?:[A-Za-z]:)?[^:\n]+)
    :
    (?P<line>\d+)
    :
    (?:
      (?P<col>\d+)
      :
    )?
    \s*
    (?P<severity>fatal\ error|error|warning|note)
    \s*
    :
    \s*
    (?P<message>.*)
    $
    """.strip(),
    re.VERBOSE,
)

MSVC_RE = re.compile(
    r"""
    ^(?P<path>.+?)
    \(
      (?P<line>\d+)
      (?:,(?P<col>\d+))?
    \)
    \s*:\s*
    (?P<severity>fatal\ error|error|warning|note)
    \s*
    (?:(?P<code>[A-Za-z]+\d+)\s*)?
    :
    \s*
    (?P<message>.*)
    $
    """.strip(),
    re.VERBOSE,
)

INDENTED_CONTINUATION_RE = re.compile(r"^\s+.+$")


def parse_cpp(text: str) -> List[Diagnostic]:
    diags: List[Diagnostic] = []
    current: Optional[Diagnostic] = None

    for line in text.splitlines():
        m = GCC_CLANG_RE.match(line)
        if m:
            current = Diagnostic(
                severity=_norm_sev(m.group("severity")),
                path=m.group("path"),
                line=int(m.group("line")),
                col=int(m.group("col")) if m.group("col") else None,
                code=None,
                message=m.group("message").strip(),
                raw=line,
            )
            diags.append(current)
            continue

        m = MSVC_RE.match(line)
        if m:
            current = Diagnostic(
                severity=_norm_sev(m.group("severity")),
                path=m.group("path"),
                line=int(m.group("line")),
                col=int(m.group("col")) if m.group("col") else None,
                code=m.group("code"),
                message=m.group("message").strip(),
                raw=line,
            )
            diags.append(current)
            continue

        if current and (INDENTED_CONTINUATION_RE.match(line) or line.strip().startswith(("^", "~"))):
            current.related.append(line.rstrip())
            continue

        if current and line.strip():
            if line.startswith(("In file included from", "                 from")):
                current.related.append(line.rstrip())

    return diags


# -------------------- Python parsing --------------------

PY_TRACEBACK_START_RE = re.compile(r"^Traceback \(most recent call last\):\s*$")
PY_FRAME_RE = re.compile(r'^\s*File "([^"]+)", line (\d+)(?:, in (.+))?\s*$')
PY_EXCEPTION_RE = re.compile(r"^(?P<etype>[A-Za-z_][A-Za-z0-9_]*)(?::\s*(?P<msg>.*))?\s*$")
PY_SYNTAXERROR_FILE_RE = re.compile(r'^\s*File "([^"]+)", line (\d+)\s*$')


def parse_python(text: str) -> List[Diagnostic]:
    lines = text.splitlines()
    diags: List[Diagnostic] = []

    i = 0
    while i < len(lines):
        if PY_TRACEBACK_START_RE.match(lines[i]):
            i += 1
            frames: List[StackFrame] = []
            while i < len(lines):
                fm = PY_FRAME_RE.match(lines[i])
                if fm:
                    path = fm.group(1)
                    line_no = int(fm.group(2))
                    func = fm.group(3).strip() if fm.group(3) else None
                    frames.append(StackFrame(path=path, line=line_no, func=func))
                    # skip source context line if present
                    if i + 1 < len(lines) and lines[i + 1].strip() and not PY_FRAME_RE.match(lines[i + 1]):
                        i += 2
                        continue
                    i += 1
                    continue

                em = PY_EXCEPTION_RE.match(lines[i].strip())
                if em and frames:
                    etype = em.group("etype")
                    msg = (em.group("msg") or "").strip()
                    last = frames[-1]
                    diags.append(
                        Diagnostic(
                            severity="error",
                            path=last.path,
                            line=last.line,
                            col=None,
                            code=etype,  # treat exception type as "rule/code"
                            message=f"{etype}: {msg}" if msg else etype,
                            raw=lines[i],
                            related=[],
                            stack=frames,
                        )
                    )
                    i += 1
                    break
                i += 1
            continue
        i += 1

    # SyntaxError-style blocks (no Traceback header)
    last_file_idx = None
    for idx, ln in enumerate(lines):
        if PY_SYNTAXERROR_FILE_RE.match(ln):
            last_file_idx = idx

    if last_file_idx is not None:
        fm = PY_SYNTAXERROR_FILE_RE.match(lines[last_file_idx])
        assert fm is not None
        path = fm.group(1)
        line_no = int(fm.group(2))

        exc_line = None
        for j in range(last_file_idx + 1, len(lines)):
            if lines[j].strip().startswith(("SyntaxError:", "IndentationError:", "TabError:")):
                exc_line = lines[j].strip()

        if exc_line:
            etype, _ = exc_line.split(":", 1)
            diags.append(
                Diagnostic(
                    severity="error",
                    path=path,
                    line=line_no,
                    col=None,
                    code=etype.strip(),
                    message=exc_line,
                    raw=exc_line,
                    related=[ln.rstrip() for ln in lines[last_file_idx + 1 :] if ln.strip()],
                    stack=[],
                )
            )

    # Dedup
    uniq: List[Diagnostic] = []
    seen = set()
    for d in diags:
        key = (d.severity, d.path, d.line, d.col, d.code, d.message)
        if key not in seen:
            seen.add(key)
            uniq.append(d)
    return uniq


# -------------------- Auto-detect --------------------

def parse_auto(text: str) -> Tuple[str, List[Diagnostic]]:
    if "Traceback (most recent call last):" in text:
        return "python", parse_python(text)
    for ln in text.splitlines():
        if GCC_CLANG_RE.match(ln) or MSVC_RE.match(ln):
            return "cpp", parse_cpp(text)
    if any(PY_SYNTAXERROR_FILE_RE.match(ln) for ln in text.splitlines()):
        return "python", parse_python(text)
    return "auto", []


# -------------------- Normalized schema helpers --------------------

def summarize(diags: List[Diagnostic]) -> Dict[str, int]:
    s = {"errors": 0, "warnings": 0, "notes": 0}
    for d in diags:
        if d.severity == "error":
            s["errors"] += 1
        elif d.severity == "warning":
            s["warnings"] += 1
        elif d.severity == "note":
            s["notes"] += 1
    return s


def canonical_json_bytes(obj: Any) -> bytes:
    # Deterministic canonicalization: sorted keys, UTF-8, no whitespace
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compute_run_id_from_input(text: str) -> str:
    # Stable run id derived from input content (deterministic)
    return sha256_hex(text.encode("utf-8", errors="replace"))[:16]


# -------------------- SARIF emission --------------------

def _relativize_path(path: str, srcroot: Optional[str]) -> str:
    if not srcroot:
        return path
    try:
        srcroot_abs = os.path.abspath(srcroot)
        path_abs = os.path.abspath(path)
        if os.path.commonpath([srcroot_abs, path_abs]) == srcroot_abs:
            rel = os.path.relpath(path_abs, srcroot_abs)
            # SARIF wants URI-ish path separators; GitHub handles forward slashes well.
            return rel.replace("\\", "/")
    except Exception:
        pass
    return path.replace("\\", "/")


def diag_rule_id(d: Diagnostic) -> str:
    # Prefer explicit code (MSVC C#### / Python ExceptionType). Else generic.
    return d.code.strip() if d.code else "DIAGPARSE.GENERIC"


def diag_fingerprint(d: Diagnostic, srcroot: Optional[str]) -> str:
    # Stable fingerprint used for de-dup / alert tracking.
    path = _relativize_path(d.path, srcroot) if d.path else ""
    core = {
        "path": path,
        "line": d.line or 0,
        "col": d.col or 0,
        "severity": _sev_to_sarif_level(d.severity),
        "ruleId": diag_rule_id(d),
        "message": d.message,
    }
    return sha256_hex(canonical_json_bytes(core))


def to_sarif(
    diags: List[Diagnostic],
    detected_kind: str,
    tool_name: str,
    tool_version: str,
    srcroot: Optional[str],
    category: str,
    max_results: Optional[int],
) -> Dict[str, Any]:
    rules_by_id: Dict[str, Dict[str, Any]] = {}
    results: List[Dict[str, Any]] = []
    notifications: List[Dict[str, Any]] = []

    def add_rule(rule_id: str, default_level: str) -> None:
        if rule_id in rules_by_id:
            return
        rules_by_id[rule_id] = {
            "id": rule_id,
            "name": rule_id,
            "shortDescription": {"text": f"{tool_name} diagnostic rule {rule_id}"},
            "fullDescription": {"text": f"Diagnostics parsed by {tool_name} (source={detected_kind})."},
            "defaultConfiguration": {"level": default_level},
        }

    kept = 0
    for d in diags:
        if max_results is not None and kept >= max_results:
            break

        level = _sev_to_sarif_level(d.severity)
        rule_id = diag_rule_id(d)
        add_rule(rule_id, level)

        # GitHub ingestion is happiest when results have at least one location.
        if not d.path or not d.line:
            notifications.append(
                {
                    "level": level,
                    "message": {"text": d.message},
                    "properties": {"raw": d.raw, "code": d.code, "sourceKind": detected_kind},
                }
            )
            continue

        uri = _relativize_path(d.path, srcroot)
        region: Dict[str, Any] = {"startLine": int(d.line)}
        if d.col and d.col > 0:
            region["startColumn"] = int(d.col)

        fp = diag_fingerprint(d, srcroot)

        results.append(
            {
                "ruleId": rule_id,
                "level": level,
                "message": {"text": d.message},
                "locations": [
                    {
                        "physicalLocation": {
                            "artifactLocation": {"uri": uri},
                            "region": region,
                        }
                    }
                ],
                "partialFingerprints": {
                    # GitHub can compute these, but we emit for determinism.
                    "diagtool/v1": fp
                },
                "properties": {
                    "sourceKind": detected_kind,
                    "severity": d.severity,
                    "code": d.code,
                    "raw": d.raw,
                    "related": d.related,
                },
            }
        )
        kept += 1

    sarif: Dict[str, Any] = {
        "$schema": SARIF_SCHEMA,
        "version": SARIF_VERSION,
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": tool_name,
                        "version": tool_version,
                        "informationUri": "https://github.com/Colt45en/coltens-world",
                        "rules": list(rules_by_id.values()),
                    }
                },
                # Category/run identity (helps when uploading multiple analyses)
                "runAutomationDetails": {"id": category},
                "invocations": [
                    {
                        "executionSuccessful": True,
                        "properties": {
                            "parsedKind": detected_kind,
                            "resultCount": len(results),
                            "notificationCount": len(notifications),
                        },
                    }
                ],
                "results": results,
            }
        ],
    }

    if notifications:
        sarif["runs"][0]["invocations"][0]["toolExecutionNotifications"] = notifications

    return sarif


# -------------------- Ledger emission --------------------

def ledger_record_from_diag(d: Diagnostic, detected_kind: str, sarif_fp: Optional[str], sarif_rule_id: Optional[str], srcroot: Optional[str]) -> Dict[str, Any]:
    path_rel = _relativize_path(d.path, srcroot) if d.path else None
    return {
        "type": "diagnostic",
        "sourceKind": detected_kind,
        "severity": d.severity,
        "path": path_rel,
        "line": d.line,
        "col": d.col,
        "code": d.code,
        "message": d.message,
        "raw": d.raw,
        "related": d.related,
        "stack": [{"path": _relativize_path(f.path, srcroot), "line": f.line, "func": f.func} for f in d.stack],
        "sarif": {"ruleId": sarif_rule_id, "fingerprint": sarif_fp},
    }


def write_ledger_ndjson(
    diags: List[Diagnostic],
    detected_kind: str,
    out_fp,
    run_id: str,
    chain: bool,
    tool_name: str,
    tool_version: str,
    srcroot: Optional[str],
) -> None:
    now = _dt.datetime.now(tz=_dt.timezone.utc).isoformat().replace("+00:00", "Z")

    prev_cid: Optional[str] = None

    # Run-start event (anchors the stream)
    run_record = {
        "type": "run_start",
        "tool": {"name": tool_name, "version": tool_version},
        "sourceKind": detected_kind,
        "runId": run_id,
        "createdAtUtc": now,
        "summary": summarize(diags),
    }
    run_cid = sha256_hex(canonical_json_bytes(run_record))
    run_event = {
        "schema": "we.ledger.event@1",
        "cid": run_cid,
        "prev": None,
        "runId": run_id,
        "observedAtUtc": now,
        "record": run_record,
    }
    out_fp.write(json.dumps(run_event, ensure_ascii=False, separators=(",", ":")) + "\n")
    prev_cid = run_cid if chain else None

    # Diagnostic events
    for d in diags:
        sarif_rule_id = diag_rule_id(d)
        sarif_fp = diag_fingerprint(d, srcroot) if d.path and d.line else None

        record = ledger_record_from_diag(d, detected_kind, sarif_fp, sarif_rule_id, srcroot)
        cid = sha256_hex(canonical_json_bytes(record))
        event = {
            "schema": "we.ledger.event@1",
            "cid": cid,
            "prev": prev_cid if chain else None,
            "runId": run_id,
            "observedAtUtc": now,
            "record": record,
        }
        out_fp.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")
        if chain:
            prev_cid = cid


# -------------------- CLI --------------------

def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=["auto", "cpp", "python"], default="auto")
    ap.add_argument("--in", dest="infile", default="-", help="Input file or '-' for stdin.")
    ap.add_argument("--emit", action="append", choices=["normalized", "sarif", "ledger"], required=True,
                    help="What to emit. Can be repeated.")
    ap.add_argument("--pretty", action="store_true", help="Pretty JSON (normalized/SARIF only).")
    ap.add_argument("--tool-name", default=TOOL_NAME_DEFAULT)
    ap.add_argument("--tool-version", default=TOOL_VERSION_DEFAULT)
    ap.add_argument("--srcroot", default=None, help="Repo root for making paths relative (recommended in CI).")

    ap.add_argument("--sarif-out", default=None, help="Where to write SARIF. Default: results.sarif.json")
    ap.add_argument("--sarif-category", default=None, help="Category/run id for SARIF. Default: runId")
    ap.add_argument("--max-results", type=int, default=None, help="Cap SARIF results count (helps size limits).")

    ap.add_argument("--ledger-out", default=None, help="Where to write ledger NDJSON. Default: ledger.ndjson")
    ap.add_argument("--ledger-chain", action="store_true", help="Hash-chain events with prev CID.")
    ap.add_argument("--run-id", default=None, help="Override run id (default derived from input hash).")

    args = ap.parse_args(argv)

    if args.infile == "-" or args.infile == "":
        text = sys.stdin.read()
    else:
        with open(args.infile, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()

    detected = args.kind
    if args.kind == "cpp":
        diags = parse_cpp(text)
        detected = "cpp"
    elif args.kind == "python":
        diags = parse_python(text)
        detected = "python"
    else:
        detected, diags = parse_auto(text)

    run_id = args.run_id or compute_run_id_from_input(text)
    category = args.sarif_category or run_id

    if args.srcroot:
        args.srcroot = os.path.abspath(args.srcroot)

    # Emit normalized
    if "normalized" in args.emit:
        out = {
            "schema_version": "1.0",
            "tool": args.tool_name,
            "source_kind": detected,
            "summary": summarize(diags),
            "diagnostics": [d.to_normalized() for d in diags],
        }
        if args.pretty:
            sys.stdout.write(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
        else:
            sys.stdout.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")

    # Emit SARIF
    if "sarif" in args.emit:
        sarif_path = args.sarif_out or "results.sarif.json"
        sarif_obj = to_sarif(
            diags=diags,
            detected_kind=detected,
            tool_name=args.tool_name,
            tool_version=args.tool_version,
            srcroot=args.srcroot,
            category=category,
            max_results=args.max_results,
        )
        with open(sarif_path, "w", encoding="utf-8") as f:
            if args.pretty:
                f.write(json.dumps(sarif_obj, indent=2, ensure_ascii=False) + "\n")
            else:
                f.write(json.dumps(sarif_obj, ensure_ascii=False, separators=(",", ":")) + "\n")

    # Emit ledger
    if "ledger" in args.emit:
        ledger_path = args.ledger_out or "ledger.ndjson"
        with open(ledger_path, "w", encoding="utf-8") as f:
            write_ledger_ndjson(
                diags=diags,
                detected_kind=detected,
                out_fp=f,
                run_id=run_id,
                chain=args.ledger_chain,
                tool_name=args.tool_name,
                tool_version=args.tool_version,
                srcroot=args.srcroot,
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
