# overseer_nexus_ai_core.py
"""
Overseer Nexus AI Core — merged module (Overseer + PrestAIChat + NSQ v6.2 + Trend Predictor)

Refactor applied:
✅ Removed SMTP/email alerts entirely
✅ Replaced alerts with BusEnvelope v1 append-only logs:
   - notes/events.jsonl (canonical JSON per line)
   - notes/events.md (human scan notes)
✅ Trend "what changed" tracking via notes/trend_state.json
✅ Trend envelope payload includes optional embed tensor (tensor.heatmap.v1)
   so downstream UI (IDE panel / 3D room blocks) can render it

Run demos:
  python overseer_nexus_ai_core.py --demo nsq
  python overseer_nexus_ai_core.py --demo trend --keyword "AI automation"
  python overseer_nexus_ai_core.py --demo overseer
"""

from __future__ import annotations

import os
import json
import zlib
import argparse
import hashlib
import time
from dataclasses import dataclass, asdict
from typing import List, Tuple, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

# Optional deps (do not hard-fail if missing)
try:
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None  # type: ignore

try:
    import matplotlib.pyplot as plt  # type: ignore
except Exception:  # pragma: no cover
    plt = None  # type: ignore

# Prophet (support new + legacy)
Prophet = None
try:  # pragma: no cover
    from prophet import Prophet as _Prophet  # type: ignore

    Prophet = _Prophet
except Exception:  # pragma: no cover
    try:
        from fbprophet import Prophet as _Prophet  # type: ignore

        Prophet = _Prophet
    except Exception:
        Prophet = None  # type: ignore

try:
    import pandas as pd  # type: ignore
except Exception:  # pragma: no cover
    pd = None  # type: ignore


# =============================================================================
# BusEnvelope v1 + Append-only Notes sink
# =============================================================================


def utc_now_iso() -> str:
    return (
        datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    )


def canonical_json(obj: Any) -> str:
    # Deterministic JSON for hashing + JSONL writing
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


class BusEnvelopeLogger:
    """
    Engine-grade append-only envelope logger.

    Files:
      - notes/events.jsonl  (machine ingest)
      - notes/events.md     (human skim)
      - notes/trend_state.json (change tracking per keyword)

    Deterministic envelope id:
      sha256( canonical_json({type, source(system,module), payload}) )
      (ts is NOT included in the id material on purpose)
    """

    def __init__(
        self,
        notes_dir: str = "notes",
        jsonl_name: str = "events.jsonl",
        md_name: str = "events.md",
    ):
        self.notes_dir = Path(notes_dir)
        self.notes_dir.mkdir(parents=True, exist_ok=True)
        self.jsonl_path = self.notes_dir / jsonl_name
        self.md_path = self.notes_dir / md_name

    def make_envelope(
        self,
        *,
        type: str,
        payload: Dict[str, Any],
        source_system: str,
        source_module: str,
        instance_id: Optional[str] = None,
        trace: Optional[Dict[str, Any]] = None,
        ts: Optional[str] = None,
    ) -> Dict[str, Any]:
        ts = ts or utc_now_iso()

        source: Dict[str, Any] = {"system": source_system, "module": source_module}
        if instance_id:
            source["instanceId"] = instance_id

        id_material = {
            "type": type,
            "source": {"system": source_system, "module": source_module},
            "payload": payload,
        }
        env_id = sha256_hex(canonical_json(id_material))

        env: Dict[str, Any] = {
            "schema": {"name": "bus.envelope", "version": "1.0.0"},
            "id": env_id,
            "type": type,
            "ts": ts,
            "source": source,
            "trace": trace or {},
            "payload": payload,
        }
        return env

    def append_jsonl(self, envelope: Dict[str, Any]) -> None:
        with self.jsonl_path.open("a", encoding="utf-8") as f:
            f.write(canonical_json(envelope) + "\n")

    def append_md(self, title: str, bullets: List[str]) -> None:
        ts = utc_now_iso()
        lines = [f"## {ts} — {title}"] + [f"- {b}" for b in bullets] + [""]
        with self.md_path.open("a", encoding="utf-8") as f:
            f.write("\n".join(lines))


# =============================================================================
# Idle Autonomy Guard — Command/Effect Split
# =============================================================================


@dataclass
class IdleGuardState:
    """Persistent guard state for any autonomous idle loop."""

    mode: str
    prompted: bool
    prompt_text: str
    approved: bool
    approval_token: str
    approval_expires_ts: float
    last_activation_ts: float
    last_block_reason: str


class IdleCommandReader:
    """
    Reads idle.command.v1 envelopes from notes/events.jsonl.
    Uses a cursor file storing byteOffset so it only processes new commands.
    """

    def __init__(
        self,
        *,
        events_path: str = "notes/events.jsonl",
        cursor_path: str = "notes/idle_cursor.json",
    ):
        self.events_path = Path(events_path)
        self.cursor_path = Path(cursor_path)
        self.cursor_path.parent.mkdir(parents=True, exist_ok=True)
        self._offset = self._load_offset()

    def _load_offset(self) -> int:
        if not self.cursor_path.exists():
            return 0
        try:
            d = json.loads(self.cursor_path.read_text(encoding="utf-8"))
            return int(d.get("byteOffset", 0))
        except Exception:
            return 0

    def _save_offset(self) -> None:
        self.cursor_path.write_text(
            json.dumps({"byteOffset": self._offset}, indent=2), encoding="utf-8"
        )

    def read_new_commands(self) -> List[Dict[str, Any]]:
        if not self.events_path.exists():
            return []

        data = self.events_path.read_bytes()
        if self._offset > len(data):
            # file rotated/truncated
            self._offset = 0

        chunk = data[self._offset :]
        self._offset = len(data)
        self._save_offset()

        lines = chunk.decode("utf-8", errors="ignore").splitlines()
        out: List[Dict[str, Any]] = []

        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                env = json.loads(line)
            except Exception:
                continue

            if env.get("type") != "idle.command.v1":
                continue

            payload = env.get("payload") or {}
            out.append(
                {
                    "id": env.get("id"),
                    "ts": env.get("ts"),
                    "source": env.get("source"),
                    "payload": payload,
                }
            )
        return out


class IdleAutonomyGuard:
    """
    Runtime guard emits EFFECTS only.
    Commands are external (idle.command.v1).

    Effects emitted:
      - idle.effect.v1 {status: prompted|approved|revoked|blocked|activated}
    """

    def __init__(
        self,
        *,
        mode: str = "dream_idle",
        notes_dir: str = "notes",
        state_path: str = "notes/idle_state.json",
        approval_ttl_seconds: int = 3600,
        instance_id: Optional[str] = None,
    ):
        self.mode = mode
        self.notes_dir = Path(notes_dir)
        self.notes_dir.mkdir(parents=True, exist_ok=True)

        self.state_path = Path(state_path)
        self.state_path.parent.mkdir(parents=True, exist_ok=True)

        self.approval_ttl_seconds = int(approval_ttl_seconds)
        self.instance_id = instance_id

        self.bus = BusEnvelopeLogger(notes_dir=notes_dir)
        self.state = self._load_state() or IdleGuardState(
            mode=self.mode,
            prompted=False,
            prompt_text="",
            approved=False,
            approval_token="",
            approval_expires_ts=0.0,
            last_activation_ts=0.0,
            last_block_reason="never_checked",
        )

    def _load_state(self) -> Optional[IdleGuardState]:
        if not self.state_path.exists():
            return None
        try:
            d = json.loads(self.state_path.read_text(encoding="utf-8"))
            if d.get("mode") != self.mode:
                return None
            return IdleGuardState(
                mode=str(d["mode"]),
                prompted=bool(d.get("prompted", False)),
                prompt_text=str(d.get("prompt_text", "")),
                approved=bool(d.get("approved", False)),
                approval_token=str(d.get("approval_token", "")),
                approval_expires_ts=float(d.get("approval_expires_ts", 0.0)),
                last_activation_ts=float(d.get("last_activation_ts", 0.0)),
                last_block_reason=str(d.get("last_block_reason", "unknown")),
            )
        except Exception:
            return None

    def _save_state(self) -> None:
        d = {
            "mode": self.state.mode,
            "prompted": self.state.prompted,
            "prompt_text": self.state.prompt_text,
            "approved": self.state.approved,
            "approval_token": self.state.approval_token,
            "approval_expires_ts": self.state.approval_expires_ts,
            "last_activation_ts": self.state.last_activation_ts,
            "last_block_reason": self.state.last_block_reason,
        }
        self.state_path.write_text(json.dumps(d, indent=2), encoding="utf-8")

    def emit_effect(self, status: str, payload: Dict[str, Any]) -> str:
        env = self.bus.make_envelope(
            type="idle.effect.v1",
            payload={
                "mode": self.mode,
                "status": status,
                **payload,
                "state": {
                    "prompted": self.state.prompted,
                    "approved": self.state.approved,
                    "approvalExpiresTs": self.state.approval_expires_ts,
                },
            },
            source_system="py-sidecar",
            source_module="idle_guard",
            instance_id=self.instance_id,
        )
        self.bus.append_jsonl(env)
        self.bus.append_md(
            title=f"idle.effect.v1:{status}",
            bullets=[
                f"mode={self.mode}",
                f"envelopeId={env['id'][:12]}",
                f"payload={payload}",
            ],
        )
        return env["id"]

    # ---- Apply COMMANDS ----

    def apply_command(self, cmd_env: Dict[str, Any]) -> None:
        payload = cmd_env.get("payload") or {}
        mode = str(payload.get("mode") or "").strip()
        if mode != self.mode:
            return

        action = str(payload.get("action") or "").strip().lower()
        args = payload.get("args") or {}
        observed_id = cmd_env.get("id")

        if action == "prompt":
            text = str(args.get("text") or "").strip()
            self.state.prompted = True
            self.state.prompt_text = text
            self._save_state()
            self.emit_effect(
                "prompted", {"prompt_text": text, "observedCommandId": observed_id}
            )
            return

        if action == "approve":
            phrase = str(args.get("phrase") or "approve").strip()
            ttl = int(args.get("ttlSeconds") or self.approval_ttl_seconds)
            now = time.time()

            token_material = {
                "mode": self.mode,
                "phrase": phrase.lower(),
                "prompt_text": self.state.prompt_text,
                "approved_at": int(now),
            }
            token = sha256_hex(canonical_json(token_material))

            self.state.approved = True
            self.state.approval_token = token
            self.state.approval_expires_ts = now + ttl
            self._save_state()

            self.emit_effect(
                "approved",
                {
                    "approval_phrase": phrase,
                    "ttlSeconds": ttl,
                    "approval_token": token,
                    "observedCommandId": observed_id,
                },
            )
            return

        if action == "revoke":
            reason = str(args.get("reason") or "revoked_by_user").strip()
            self.state.approved = False
            self.state.approval_token = ""
            self.state.approval_expires_ts = 0.0
            self._save_state()
            self.emit_effect(
                "revoked", {"reason": reason, "observedCommandId": observed_id}
            )
            return

        self.emit_effect(
            "blocked",
            {
                "reason": f"blocked:unknown_action:{action}",
                "observedCommandId": observed_id,
            },
        )

    # ---- Gate execution ----

    def can_activate(self) -> Tuple[bool, str]:
        now = time.time()

        if not self.state.prompted:
            reason = "blocked:not_prompted"
            self.state.last_block_reason = reason
            self._save_state()
            self.emit_effect("blocked", {"reason": reason})
            return False, reason

        if not self.state.approved:
            reason = "blocked:not_approved"
            self.state.last_block_reason = reason
            self._save_state()
            self.emit_effect("blocked", {"reason": reason})
            return False, reason

        if now > self.state.approval_expires_ts:
            reason = "blocked:approval_expired"
            self.state.last_block_reason = reason
            self.state.approved = False
            self.state.approval_token = ""
            self._save_state()
            self.emit_effect("blocked", {"reason": reason})
            return False, reason

        return True, "ok"

    def mark_activated(self) -> None:
        self.state.last_activation_ts = time.time()
        self._save_state()
        self.emit_effect(
            "activated",
            {
                "approval_token": self.state.approval_token,
                "prompt_text": self.state.prompt_text,
            },
        )


# =============================================================================
# Overseer Nexus — Orchestrator
# =============================================================================


class OverseerNexus:
    """
    Simple agent swarm orchestrator.
    - assign_task(task, agent_type): routes task to first matching agent instance
    - optimize_ai_swarm(): calls self_adjust() on all agents that have it
    """

    def __init__(self, agents: List[object]):
        self.agents = list(agents)
        self.task_queue: List[Dict[str, Any]] = []

    def register_agent(self, agent: object) -> None:
        self.agents.append(agent)

    def assign_task(self, task: str, agent_type: type) -> str:
        for agent in self.agents:
            if isinstance(agent, agent_type):
                if hasattr(agent, "process_task"):
                    return str(agent.process_task(task))  # type: ignore[attr-defined]
                return "Agent found, but it has no process_task()."
        return "No suitable agent found."

    def enqueue_task(self, task: str, agent_type: type) -> None:
        self.task_queue.append({"task": task, "agent_type": agent_type})

    def run_queue(self) -> List[str]:
        out: List[str] = []
        while self.task_queue:
            item = self.task_queue.pop(0)
            out.append(self.assign_task(item["task"], item["agent_type"]))
        return out

    def optimize_ai_swarm(self) -> None:
        for agent in self.agents:
            fn = getattr(agent, "self_adjust", None)
            if callable(fn):
                fn()


# =============================================================================
# PrestAIChat — Cloud/local selection + offline memory
# =============================================================================


class PrestAIChat:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = "https://api.prest-ai.com/v1/chat"
        self.local_memory: List[Tuple[str, str]] = []

    def is_online(self) -> bool:
        if requests is None:
            return False
        try:
            requests.get("https://www.google.com", timeout=3)
            return True
        except Exception:
            return False

    def analyze_query(self, query: str) -> str:
        keywords = ["summarize", "analyze", "compare", "deep insights"]
        return "cloud" if any(k in query.lower() for k in keywords) else "local"

    def send_message(self, message: str) -> str:
        processing_mode = self.analyze_query(message)
        online = self.is_online()

        if (not online) or processing_mode == "local":
            return self.local_ai_response(message)

        if requests is None:
            return self.local_ai_response(message)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        data = {"prompt": message, "max_tokens": 200}
        try:
            resp = requests.post(self.api_url, json=data, headers=headers, timeout=30)
        except Exception:
            return "Error communicating with Prest AI."

        if resp.status_code == 200:
            try:
                reply = resp.json().get("response", "No response from AI.")
            except Exception:
                reply = "No response from AI."
            self.local_memory.append((message, reply))
            return reply

        return "Error communicating with Prest AI."

    def local_ai_response(self, message: str) -> str:
        for q, r in reversed(self.local_memory):
            if q and (q in message):
                return f"[Offline Mode] Closest match: {r}"
        return "[Offline Mode] AI cannot process this request right now."


# =============================================================================
# Agent Stubs
# =============================================================================


class TaskManagerAgent:
    def process_task(self, task: str) -> str:
        return f"TaskManagerAgent processed: {task}"

    def self_adjust(self) -> None:
        pass


class AIMemoryAgent:
    def process_task(self, task: str) -> str:
        return f"MemoryAgent processed memory task: {task}"

    def self_adjust(self) -> None:
        pass


class AutoOptimizerAgent:
    def process_task(self, task: str) -> str:
        return f"Optimizer processed: {task}"

    def self_adjust(self) -> None:
        pass


# =============================================================================
# NSQ v6.2 — NovaSynapse
# =============================================================================


@dataclass
class CompressionRecord:
    iteration: int
    method: str
    ratio: float
    entropy_pre: Optional[float]
    entropy_post: Optional[float]
    depth: int


class NovaSynapse:
    """
    NSQ v6.2 — Auto-adaptive compression with entropy tracking and recursive depth.
    """

    def __init__(
        self,
        data_size: int,
        memory_file: str = "ai_memory_v6_2.json",
        seed: int = 123,
        log_path: str = "compression_log.jsonl",
    ):
        if data_size <= 0:
            raise ValueError("data_size must be positive")

        rng = np.random.default_rng(seed)
        self.original_data = rng.random(data_size).astype(np.float64)
        self.compressed_data: Optional[object] = None
        self.last_method: Optional[str] = None
        self._pca_params: Optional[Dict[str, Any]] = None

        self.compression_ratios: List[float] = []
        self.method_history: List[str] = []
        self.records: List[CompressionRecord] = []

        self.memory_file = memory_file
        self.log_path = log_path
        self._iter = 0

        self.load_memory()

    def load_memory(self) -> None:
        if os.path.exists(self.memory_file):
            try:
                with open(self.memory_file, "r", encoding="utf-8") as f:
                    d = json.load(f)
                self.compression_ratios = list(d.get("compression_ratios", []))
                self.method_history = list(d.get("method_history", []))
            except Exception:
                pass

    def save_memory(self) -> None:
        data = {
            "compression_ratios": self.compression_ratios,
            "method_history": self.method_history,
        }
        with open(self.memory_file, "w", encoding="utf-8") as f:
            json.dump(data, f)

    def _entropy_bytes(self, b: bytes) -> float:
        if not b:
            return 0.0
        counts = np.bincount(np.frombuffer(b, dtype=np.uint8), minlength=256).astype(
            np.float64
        )
        probs = counts / counts.sum()
        nonzero = probs[probs > 0]
        return float(-np.sum(nonzero * np.log2(nonzero)))

    def _compress_zlib(
        self, payload: bytes, level: int = 6
    ) -> Tuple[bytes, float, float]:
        pre_entropy = self._entropy_bytes(payload)
        c = zlib.compress(payload, level=level)
        post_entropy = self._entropy_bytes(c)
        return c, pre_entropy, post_entropy

    def _compress_pca(self) -> np.ndarray:
        x = self.original_data
        mean = float(np.mean(x))
        scores = (x - mean).reshape(-1, 1).astype(np.float64)
        components = np.array([[1.0]], dtype=np.float64)
        self._pca_params = {
            "mean": mean,
            "components": components,
            "orig_len": int(len(x)),
        }
        return scores

    def decompress(self, method: Optional[str] = None) -> np.ndarray:
        if self.compressed_data is None:
            raise ValueError("Nothing compressed yet")
        m = method or self.last_method
        if m == "zlib":
            raw = zlib.decompress(self.compressed_data)  # type: ignore[arg-type]
            return np.frombuffer(raw, dtype=np.float64)
        if m == "pca":
            if self._pca_params is None:
                raise ValueError("Missing PCA parameters; compress with pca first.")
            mean = float(self._pca_params["mean"])
            comps = np.asarray(self._pca_params["components"], dtype=np.float64)
            scores = np.asarray(self.compressed_data, dtype=np.float64)
            recon = (scores @ comps).reshape(-1) + mean
            return recon[: int(self._pca_params["orig_len"])].astype(
                np.float64, copy=False
            )
        raise ValueError(f"Unknown method for decompress: {m}")

    def _append_jsonl(self, rec: CompressionRecord) -> None:
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(rec)) + "\n")

    def export_log(self, out_path: str = "compression_log.json") -> str:
        rows: List[dict] = []
        if os.path.exists(self.log_path):
            with open(self.log_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rows.append(json.loads(line))
                    except Exception:
                        pass
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)
        return out_path

    def auto_compress(self) -> Tuple[str, float]:
        payload = self.original_data.tobytes(order="C")
        z_c, z_pre, z_post = self._compress_zlib(payload, level=6)
        z_ratio = len(z_c) / self.original_data.nbytes

        scores = self._compress_pca()
        p_storage = scores.nbytes + 8 + 8
        p_ratio = p_storage / self.original_data.nbytes

        self._iter += 1
        if z_ratio <= p_ratio:
            self.compressed_data = z_c
            self.last_method = "zlib"
            chosen = "zlib"
            ratio = float(z_ratio)
            rec = CompressionRecord(
                self._iter, "zlib", ratio, float(z_pre), float(z_post), 1
            )
        else:
            self.compressed_data = scores
            self.last_method = "pca"
            chosen = "pca"
            ratio = float(p_ratio)
            rec = CompressionRecord(self._iter, "pca", ratio, None, None, 1)

        self.records.append(rec)
        self.compression_ratios.append(ratio)
        self.method_history.append(chosen)
        self._append_jsonl(rec)
        return chosen, ratio


class NovaSynapseAgent:
    def __init__(self, ns: NovaSynapse):
        self.ns = ns

    def process_task(self, task: str) -> str:
        t = (task or "").strip()
        if not t.lower().startswith("nsq:"):
            return "NovaSynapseAgent: task ignored (prefix with 'nsq:')."
        parts = t[4:].strip().split()
        cmd = parts[0].lower() if parts else ""
        if cmd == "auto":
            n = int(parts[1]) if len(parts) >= 2 else 1
            out = []
            for i in range(n):
                m, r = self.ns.auto_compress()
                out.append(f"iter={i + 1} method={m} ratio={r:.6f}")
            return "\n".join(out)
        return f"NovaSynapseAgent: unknown command '{cmd}'."


# =============================================================================
# Trend Predictor — BusEnvelope + Notes + State + Tensor embed
# =============================================================================


class TrendPredictor:
    def __init__(
        self,
        alert_threshold: float = 90.0,
        notes_dir: str = "notes",
        state_path: str = "notes/trend_state.json",
        instance_id: Optional[str] = None,
    ):
        self.alert_threshold = float(alert_threshold)
        self.log = BusEnvelopeLogger(notes_dir=notes_dir)
        self.instance_id = instance_id

        self.state_path = Path(state_path)
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self._state: Dict[str, Any] = self._load_state()

    def _load_state(self) -> Dict[str, Any]:
        if not self.state_path.exists():
            return {}
        try:
            return json.loads(self.state_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _save_state(self) -> None:
        self.state_path.write_text(json.dumps(self._state, indent=2), encoding="utf-8")

    def _compute_change(self, keyword: str, forecast_value: float) -> Dict[str, Any]:
        prev = self._state.get(keyword, {}).get("forecastValue")
        if prev is None:
            return {
                "prevForecastValue": None,
                "deltaForecastValue": None,
                "pctForecastValue": None,
            }
        prev = float(prev)
        delta = float(forecast_value - prev)
        pct = None if prev == 0.0 else float((delta / prev) * 100.0)
        return {
            "prevForecastValue": prev,
            "deltaForecastValue": delta,
            "pctForecastValue": pct,
        }

    def _update_state(
        self, keyword: str, forecast_date: str, forecast_value: float
    ) -> None:
        self._state[keyword] = {
            "forecastDate": forecast_date,
            "forecastValue": float(forecast_value),
            "updatedAt": utc_now_iso(),
        }
        self._save_state()

    def get_google_trends(self, keyword: str = "AI", geo: str = "US", days: int = 30):
        if pd is None:
            today = datetime.now()
            last = today - timedelta(days=int(days))
            dates = [last + timedelta(days=i) for i in range((today - last).days + 1)]
            y = np.random.randint(50, 100, size=len(dates)).astype(float)
            return [{"ds": d, "y": float(v)} for d, v in zip(dates, y)]

        today = datetime.now()
        last_month = today - timedelta(days=int(days))
        dates = pd.date_range(start=last_month, end=today, freq="D")
        search_volume = np.random.randint(50, 100, size=len(dates))
        return pd.DataFrame({"ds": dates, "y": search_volume})

    def train_and_forecast(self, df, periods: int = 14):
        if Prophet is not None and pd is not None and hasattr(df, "copy"):
            model = Prophet()
            model.fit(df)
            future = model.make_future_dataframe(periods=int(periods))
            forecast = model.predict(future)
            return {"model": model, "forecast": forecast, "mode": "prophet"}

        # naive fallback
        if pd is not None and hasattr(df, "iloc"):
            y = df["y"].astype(float).to_numpy()
            ds = df["ds"].to_list()
        else:
            y = np.array([float(r["y"]) for r in df], dtype=float)
            ds = [r["ds"] for r in df]

        if len(y) >= 7:
            slope = (y[-1] - y[-7]) / 6.0
        elif len(y) >= 2:
            slope = y[-1] - y[-2]
        else:
            slope = 0.0

        last_date = ds[-1] if ds else datetime.now()
        last_val = float(y[-1]) if len(y) else 0.0
        future_rows = []
        for i in range(1, int(periods) + 1):
            d = last_date + timedelta(days=i)
            future_rows.append({"ds": d, "yhat": float(last_val + slope * i)})

        return {"model": None, "forecast": future_rows, "mode": "naive"}

    def plot_forecast(self, model, forecast, keyword: str = "AI") -> Optional[str]:
        if plt is None:
            return None

        safe = keyword.replace(" ", "_").replace("/", "_")
        plot_path = Path("notes") / f"trend_forecast_{safe}.png"
        plot_path.parent.mkdir(parents=True, exist_ok=True)

        if model is not None and hasattr(model, "plot"):
            model.plot(forecast)
            plt.title(f"{keyword} Trend Forecast")
            plt.grid(True)
            plt.tight_layout()
            plt.savefig(plot_path)
            plt.close()
            return str(plot_path)

        ds = [r["ds"] for r in forecast]
        yhat = [r["yhat"] for r in forecast]
        plt.figure()
        plt.plot(ds, yhat)
        plt.title(f"{keyword} Trend Forecast (Naive)")
        plt.grid(True)
        plt.tight_layout()
        plt.savefig(plot_path)
        plt.close()
        return str(plot_path)

    def _tensor_embed_from_history(self, df) -> Dict[str, Any]:
        # Build a 5x6 tensor (30 cells) normalized from last ~30 y values
        if pd is not None and hasattr(df, "iloc"):
            vals = df["y"].astype(float).to_numpy().tolist()
        else:
            vals = [float(r["y"]) for r in df]
        vals = vals[-30:]
        while len(vals) < 30:
            vals.insert(0, vals[0] if vals else 0.0)

        vmin = float(min(vals)) if vals else 0.0
        vmax = float(max(vals)) if vals else 1.0
        denom = (vmax - vmin) if (vmax - vmin) != 0 else 1.0
        norm = [float((v - vmin) / denom) for v in vals]

        return {
            "kind": "tensor.heatmap.v1",
            "tensor": {
                "shape": [5, 6],
                "values": norm,
                "valueRange": {"min": 0.0, "max": 1.0},
                "title": "Trend (last 30d, normalized)",
            },
        }

    def run_trend_forecast(
        self,
        keyword: str = "AI",
        geo: str = "US",
        days: int = 30,
        periods: int = 14,
        plot: bool = True,
    ) -> Dict[str, Any]:
        df = self.get_google_trends(keyword=keyword, geo=geo, days=days)
        trained = self.train_and_forecast(df, periods=periods)
        forecast = trained["forecast"]
        mode = trained["mode"]

        if pd is not None and mode == "prophet":
            forecast_value = float(forecast.iloc[-1]["yhat"])
            forecast_date = str(forecast.iloc[-1]["ds"].date())
        else:
            forecast_value = float(forecast[-1]["yhat"]) if forecast else 0.0
            forecast_date = (
                str(forecast[-1]["ds"].date())
                if forecast
                else str(datetime.now().date())
            )

        plot_path = (
            self.plot_forecast(trained.get("model"), forecast, keyword)
            if plot
            else None
        )
        change = self._compute_change(keyword, forecast_value)

        is_alert = forecast_value > self.alert_threshold
        env_type = "trend.alert.v1" if is_alert else "trend.forecast.v1"

        payload: Dict[str, Any] = {
            "keyword": keyword,
            "mode": mode,
            "forecastDate": forecast_date,
            "forecastValue": forecast_value,
            "threshold": self.alert_threshold,
            "plotPath": plot_path,
            "change": change,
            "embed": self._tensor_embed_from_history(df),
        }

        env = self.log.make_envelope(
            type=env_type,
            payload=payload,
            source_system="py-sidecar",
            source_module="trend_predictor",
            instance_id=self.instance_id,
        )
        self.log.append_jsonl(env)

        title = "Trend spike" if is_alert else "Trend forecast"
        self.log.append_md(
            title=title,
            bullets=[
                f"keyword={keyword}",
                f"type={env_type}",
                f"mode={mode}",
                f"forecastDate={forecast_date}",
                f"forecastValue={forecast_value:.2f}",
                f"threshold={self.alert_threshold:.2f}",
                f"delta={change.get('deltaForecastValue')}",
                f"envelopeId={env['id'][:12]}",
            ],
        )

        self._update_state(keyword, forecast_date, forecast_value)

        return {
            "envelopeId": env["id"],
            "type": env_type,
            "payload": payload,
        }


class TrendPredictorAgent:
    def __init__(self, predictor: TrendPredictor):
        self.tp = predictor
        self.last_result: Optional[Dict[str, Any]] = None

    def process_task(self, task: str) -> str:
        t = (task or "").strip()
        if not t.lower().startswith("trend:"):
            return "TrendPredictorAgent: task ignored (prefix with 'trend:')."

        parts = t[6:].strip().split()
        cmd = parts[0].lower() if parts else ""

        if cmd == "run":
            keyword = " ".join(parts[1:]).strip() or "AI"
            res = self.tp.run_trend_forecast(keyword=keyword, plot=True)
            self.last_result = res
            return json.dumps(res, indent=2)

        if cmd == "stats":
            return json.dumps({"last_result": self.last_result}, indent=2)

        return f"TrendPredictorAgent: unknown command '{cmd}'."


# =============================================================================
# Demos / CLI
# =============================================================================


def demo_nsq() -> None:
    ns = NovaSynapse(1000, memory_file="ai_memory_v6_2.json", seed=42)
    for i in range(10):
        method, ratio = ns.auto_compress()
        print(f"iter={i + 1} method={method} ratio={ratio:.6f}")
    ns.save_memory()
    out = ns.export_log("compression_log.json")
    print("Exported log to:", out)


def demo_trend(keyword: str) -> None:
    tp = TrendPredictor(alert_threshold=90.0)
    res = tp.run_trend_forecast(keyword=keyword, plot=True)
    print(json.dumps(res, indent=2))


def demo_overseer() -> None:
    ns = NovaSynapse(1000, memory_file="ai_memory_v6_2.json", seed=42)
    tp = TrendPredictor(alert_threshold=90.0)

    swarm = OverseerNexus(
        agents=[
            TaskManagerAgent(),
            AIMemoryAgent(),
            AutoOptimizerAgent(),
            NovaSynapseAgent(ns),
            TrendPredictorAgent(tp),
        ]
    )

    swarm.enqueue_task("nsq:auto 5", NovaSynapseAgent)
    swarm.enqueue_task("trend:run AI automation", TrendPredictorAgent)
    results = swarm.run_queue()
    print("\n--- Overseer Queue Results ---")
    for r in results:
        print(r)
        print()


def run_idle_runtime(mode: str = "dream_idle") -> None:
    """
    Main runtime loop for idle autonomy.

    Continuously:
      1. Read new idle.command.v1 envelopes
      2. Apply them to state
      3. Check if can activate
      4. Mark activated if OK
    """
    reader = IdleCommandReader(
        events_path="notes/events.jsonl", cursor_path="notes/idle_cursor.json"
    )
    guard = IdleAutonomyGuard(mode=mode, approval_ttl_seconds=3600)

    print(f"[idle] starting runtime for mode={mode}")
    print("[idle] commands: notes/events.jsonl")
    print("[idle] cursor: notes/idle_cursor.json")
    print("[idle] state: notes/idle_state.json")

    while True:
        # 1) consume commands
        for cmd in reader.read_new_commands():
            guard.apply_command(cmd)

        # 2) gate idle tick
        ok, reason = guard.can_activate()
        if ok:
            guard.mark_activated()
            # TODO: run your real idle work here
            # run_dream_idle_tick()
            time.sleep(1.0)
        else:
            time.sleep(0.5)


def main() -> None:
    ap = argparse.ArgumentParser(description="Overseer Nexus AI Core (merged).")
    ap.add_argument("--demo", choices=["nsq", "trend", "overseer"], default=None)
    ap.add_argument("--keyword", type=str, default="AI automation")
    ap.add_argument(
        "--run-idle", action="store_true", help="Run idle autonomy guard runtime"
    )
    ap.add_argument(
        "--idle-mode", type=str, default="dream_idle", help="Idle mode name"
    )
    args = ap.parse_args()

    if args.run_idle:
        run_idle_runtime(mode=args.idle_mode)
    elif args.demo == "nsq":
        demo_nsq()
    elif args.demo == "overseer":
        demo_overseer()
    elif args.demo == "trend":
        demo_trend(keyword=args.keyword)
    else:
        print(
            "Use: python overseer_nexus_ai_core.py --demo [nsq|trend|overseer] --run-idle"
        )
        print("  --demo nsq        : compression demo")
        print("  --demo trend      : trend prediction")
        print("  --demo overseer   : swarm orchestration")
        print("  --run-idle        : start idle runtime (production)")


if __name__ == "__main__":
    main()
