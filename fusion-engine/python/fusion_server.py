# python/fusion_server.py
import asyncio
import json
import os
import re
import subprocess
import time
import uuid
import base64
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from render_engine import render_html_content, render_html_file

ENVELOPE_VERSION = "1.0"

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MEDIA_DIR = DATA_DIR / "media"
RENDER_DIR = DATA_DIR / "renders"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
RENDER_DIR.mkdir(parents=True, exist_ok=True)


def uid(prefix: str = "id") -> str:
    return f"{prefix}-{int(time.time() * 1000)}-{uuid.uuid4().hex[:10]}"


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z"


@dataclass
class ToolAction:
    name: str
    args: Dict[str, Any]


class ToolRunner:
    """
    Runs the C++ recorder tool as a subprocess and returns a /media URL.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()

    def _find_recorder_exe(self) -> str:
        # Allow override
        env = os.environ.get("FUSION_RECORDER_EXE")
        if env and Path(env).exists():
            return env

        # Try common build locations relative to repo root
        candidates = [
            ROOT.parent / "cpp" / "build" / "Release" / "fusion_recorder.exe",
            ROOT.parent / "cpp" / "build" / "fusion_recorder.exe",
            ROOT.parent / "cpp" / "build" / "fusion_recorder",
        ]
        for c in candidates:
            if c.exists():
                return str(c)

        # Fallback to PATH
        return "fusion_recorder.exe"

    async def record_screen(
        self,
        duration_s: int,
        width: int,
        height: int,
        fps: int,
        bitrate: int,
        mic: str = "",
        sys: str = "",
    ) -> Dict[str, Any]:
        out_name = f"screen_{int(time.time())}_{uuid.uuid4().hex[:6]}.mp4"
        out_path = MEDIA_DIR / out_name

        exe = self._find_recorder_exe()
        cmd = [
            exe,
            "record-screen",
            "--duration",
            str(duration_s),
            "--out",
            str(out_path),
            "--width",
            str(width),
            "--height",
            str(height),
            "--fps",
            str(fps),
            "--bitrate",
            str(bitrate),
        ]
        if mic:
            cmd += ["--mic", mic]
        if sys:
            cmd += ["--sys", sys]

        return await self._run_tool(cmd, out_name)

    async def record_audio(self, duration_s: int, mic: str = "") -> Dict[str, Any]:
        out_name = f"audio_{int(time.time())}_{uuid.uuid4().hex[:6]}.m4a"
        out_path = MEDIA_DIR / out_name

        exe = self._find_recorder_exe()
        cmd = [
            exe,
            "record-audio",
            "--duration",
            str(duration_s),
            "--out",
            str(out_path),
        ]
        if mic:
            cmd += ["--mic", mic]

        return await self._run_tool(cmd, out_name)

    async def _run_tool(self, cmd: list[str], out_name: str) -> Dict[str, Any]:
        async with self._lock:
            # Run tool and parse JSON from stdout.
            proc = await asyncio.to_thread(
                lambda: subprocess.run(cmd, capture_output=True, text=True, shell=False)
            )

            stdout = (proc.stdout or "").strip()
            stderr = (proc.stderr or "").strip()

            tool_json: Optional[Dict[str, Any]] = None
            if stdout.startswith("{") and stdout.endswith("}"):
                try:
                    tool_json = json.loads(stdout)
                except Exception:
                    tool_json = None

            ok = (
                (proc.returncode == 0)
                and (tool_json is not None)
                and bool(tool_json.get("ok", False))
            )
            if not ok:
                return {
                    "ok": False,
                    "error": {
                        "returncode": proc.returncode,
                        "stdout": stdout[:4000],
                        "stderr": stderr[:4000],
                        "cmd": cmd,
                    },
                }

            return {
                "ok": True,
                "result": {
                    "media_url": f"/media/{out_name}",
                    "out": tool_json.get("out") if tool_json else None,
                    "duration_s": tool_json.get("duration_s") if tool_json else None,
                    "exit_code": tool_json.get("exit_code") if tool_json else None,
                },
            }


tool_runner = ToolRunner()
app = FastAPI()

# Serve recordings and renders
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")
app.mount("/renders", StaticFiles(directory=str(RENDER_DIR)), name="renders")


async def ws_send(
    ws: WebSocket, trace_id: str, kind: str, payload: Dict[str, Any]
) -> None:
    msg: Dict[str, Any] = {
        "v": ENVELOPE_VERSION,
        "id": uid("env"),
        "ts": now_iso(),
        "traceId": trace_id,
        "source": "fusion-python",
        "kind": kind,
        "payload": payload,
    }
    await ws.send_text(json.dumps(msg))


def detect_action(text: str) -> Optional[ToolAction]:
    """
    Very small command detector (replace this with your LLM planner).
    Accepts:
      - "record screen 10"
      - "record audio 5"
      - "render html <content>"
      - "render file <path>"
    """
    t = text.strip().lower()

    m = re.search(r"\brecord\s+screen\s+(\d+)\b", t)
    if m:
        dur = int(m.group(1))
        return ToolAction(
            "record_screen",
            {
                "duration_s": dur,
                "width": 1920,
                "height": 1080,
                "fps": 30,
                "bitrate": 2500,
            },
        )

    m = re.search(r"\brecord\s+audio\s+(\d+)\b", t)
    if m:
        dur = int(m.group(1))
        return ToolAction("record_audio", {"duration_s": dur})

    if t.startswith("render html "):
        html_content = text[12:].strip()  # Remove "render html "
        return ToolAction("render_html", {"html": html_content})

    if t.startswith("render file "):
        file_path = text[12:].strip()  # Remove "render file "
        return ToolAction("render_file", {"file_path": file_path})

    return None


async def stream_text(ws: WebSocket, trace_id: str, convo_id: str, text: str) -> None:
    await ws_send(ws, trace_id, "chat.start", {"convoId": convo_id})
    # stream in chunks for UI feel
    for i in range(0, len(text), 32):
        await ws_send(
            ws, trace_id, "chat.delta", {"convoId": convo_id, "delta": text[i : i + 32]}
        )
        await asyncio.sleep(0.01)
    await ws_send(ws, trace_id, "chat.response", {"convoId": convo_id, "evidence": {}})


@app.websocket("/ws/chat")
async def ws_chat(ws: WebSocket):
    await ws.accept()
    trace_id = uid("trace")

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            if msg.get("v") != ENVELOPE_VERSION:
                continue

            kind = msg.get("kind")
            payload: Dict[str, Any] = msg.get("payload") or {}
            if kind != "chat.request":
                continue

            convo_id: str = payload.get("convoId") or uid("conv")
            user_text: str = (payload.get("text") or "").strip()
            if not user_text:
                continue

            action = detect_action(user_text)

            if not action:
                # default assistant response (replace with your model)
                await stream_text(
                    ws,
                    trace_id,
                    convo_id,
                    "✅ Connected to Fusion Python core. Say: 'record screen 10' or 'record audio 5'.",
                )
                continue

            # Show action evidence + run tool
            evidence: Dict[str, Any] = {
                "actions": [
                    {
                        "name": action.name,
                        "argsPreview": json.dumps(action.args),
                    }
                ],
                "grounding": [],
            }

            await ws_send(ws, trace_id, "chat.start", {"convoId": convo_id})
            await ws_send(
                ws,
                trace_id,
                "chat.delta",
                {"convoId": convo_id, "delta": f"🛠 Running tool: {action.name}...\n"},
            )

            res: Dict[str, Any]
            if action.name == "record_screen":
                res = await tool_runner.record_screen(**action.args)
            elif action.name == "record_audio":
                res = await tool_runner.record_audio(**action.args)
            elif action.name == "render_html":
                render_result = await render_html_content(action.args["html"])
                res = {"ok": True, "result": render_result}
            elif action.name == "render_file":
                render_result = await render_html_file(action.args["file_path"])
                res = {"ok": True, "result": render_result}
            else:
                res = {"ok": False, "error": f"Unknown action: {action.name}"}

            if not res["ok"]:
                err: Any = res["error"]
                await ws_send(
                    ws,
                    trace_id,
                    "chat.delta",
                    {"convoId": convo_id, "delta": "❌ Tool failed.\n"},
                )
                await ws_send(
                    ws,
                    trace_id,
                    "chat.delta",
                    {
                        "convoId": convo_id,
                        "delta": f"stderr:\n{err.get('stderr', '')[:1200]}\n",
                    },
                )
                await ws_send(
                    ws,
                    trace_id,
                    "chat.response",
                    {"convoId": convo_id, "evidence": evidence},
                )
                continue

            if "media_url" in res.get("result", {}):
                media_url = res["result"]["media_url"]
                await ws_send(
                    ws,
                    trace_id,
                    "chat.delta",
                    {"convoId": convo_id, "delta": f"✅ Done. Download: {media_url}\n"},
                )
            elif "data" in res:
                # Render result
                render_url = f"/renders/{uid('render')}.{res['format']}"
                render_path = RENDER_DIR / f"{uid('render')}.{res['format']}"
                with open(render_path, "wb") as f:
                    f.write(base64.b64decode(res["data"]))
                await ws_send(
                    ws,
                    trace_id,
                    "chat.delta",
                    {
                        "convoId": convo_id,
                        "delta": f"✅ Rendered. View: {render_url}\n",
                    },
                )
            else:
                await ws_send(
                    ws,
                    trace_id,
                    "chat.delta",
                    {"convoId": convo_id, "delta": "✅ Tool completed.\n"},
                )

            await ws_send(
                ws,
                trace_id,
                "chat.response",
                {"convoId": convo_id, "evidence": evidence},
            )

    except WebSocketDisconnect:
        return
