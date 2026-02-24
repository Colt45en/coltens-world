from __future__ import annotations

import base64
import io
import time
from typing import Any, Dict, Tuple

# Try to import pyautogui, fallback to stub if not available
try:
    import pyautogui
    from PIL import Image
    PYAUTOGUI_AVAILABLE = True
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.05
except ImportError:
    PYAUTOGUI_AVAILABLE = False
    print("⚠️  PyAutoGUI not available - desktop automation disabled")

from fastapi import FastAPI
from pydantic import BaseModel

from .audit import audit_desktop_action

app = FastAPI(title="World Engine Desktop Host", version="1.0")

class DesktopExecute(BaseModel):
    action: Dict[str, Any]
    trace_id: str
    session_id: str

def _screen_size() -> Tuple[int, int]:
    if PYAUTOGUI_AVAILABLE:
        w, h = pyautogui.size()
        return int(w), int(h)
    return 1920, 1080  # Default fallback

def _png_b64(img: 'Image.Image') -> str:
    if not PYAUTOGUI_AVAILABLE:
        return ""  # Empty for now
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def _clamp(x: int, y: int) -> Tuple[int, int]:
    w, h = _screen_size()
    return max(0, min(x, w - 1)), max(0, min(y, h - 1))

@app.get("/health")
def health():
    return {"ok": True, "ts": time.time()}

@app.post("/desktop/execute")
def desktop_execute(req: DesktopExecute):
    a = req.action
    kind = str(a.get("kind", "")).lower()

    audit_desktop_action("desktop.request", req.trace_id, req.session_id, {"action": a})

    if not PYAUTOGUI_AVAILABLE:
        return {
            "success": False,
            "result": {},
            "error": "PyAutoGUI not available - install with: pip install pyautogui pillow"
        }

    try:
        if kind == "screenshot":
            img = pyautogui.screenshot()
            w, h = _screen_size()
            audit_desktop_action("desktop.result", req.trace_id, req.session_id, {"ok": True, "kind": kind})
            return {
                "success": True,
                "result": {
                    "image_base64_png": _png_b64(img),
                    "screen_width": w,
                    "screen_height": h,
                    "ts": time.time(),
                },
                "error": None,
            }

        if kind in {"mouse_move", "left_click", "right_click", "double_click"}:
            x = int(a.get("x", 0))
            y = int(a.get("y", 0))
            x, y = _clamp(x, y)
            pyautogui.moveTo(x, y, duration=0.05)

            if kind == "left_click":
                pyautogui.click(x, y, button="left")
            elif kind == "right_click":
                pyautogui.click(x, y, button="right")
            elif kind == "double_click":
                pyautogui.doubleClick(x, y, button="left")

            audit_desktop_action("desktop.result", req.trace_id, req.session_id, {"ok": True, "kind": kind})
            return {"success": True, "result": {"kind": kind, "x": x, "y": y}, "error": None}

        if kind == "type":
            text = str(a.get("text", ""))
            pyautogui.typewrite(text, interval=0.01)
            audit_desktop_action("desktop.result", req.trace_id, req.session_id, {"ok": True, "kind": kind})
            return {"success": True, "result": {"typed": len(text)}, "error": None}

        if kind == "key":
            combo = str(a.get("key", "")).lower().strip()
            keys = [k.strip() for k in combo.split("+") if k.strip()]
            pyautogui.hotkey(*keys)
            audit_desktop_action("desktop.result", req.trace_id, req.session_id, {"ok": True, "kind": kind})
            return {"success": True, "result": {"key": combo}, "error": None}

        if kind == "scroll":
            direction = str(a.get("direction", "down")).lower()
            amount = int(a.get("amount", 3))
            amount = max(1, min(amount, 50))
            delta = amount * 120
            if direction == "down":
                delta = -delta
            pyautogui.scroll(delta)
            audit_desktop_action("desktop.result", req.trace_id, req.session_id, {"ok": True, "kind": kind})
            return {"success": True, "result": {"direction": direction, "amount": amount}, "error": None}

        audit_desktop_action("desktop.result", req.trace_id, req.session_id, {"ok": False, "kind": kind, "error": f"Unknown kind: {kind}"})
        return {"success": False, "result": {}, "error": f"Unknown kind: {kind}"}

    except Exception as e:
        audit_desktop_action("desktop.error", req.trace_id, req.session_id, {"ok": False, "error": str(e), "kind": kind})
        return {"success": False, "result": {}, "error": f"{type(e).__name__}: {e}"}
