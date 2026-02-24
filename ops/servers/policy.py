from __future__ import annotations

from typing import Any, Dict, Tuple

DESKTOP_KINDS = {"screenshot", "mouse_move", "left_click", "right_click", "double_click", "type", "key", "scroll"}

BLOCKED_KEY_COMBOS = {
    "alt+f4", "ctrl+alt+del", "ctrl+shift+esc",
    "win+r", "win+x", "win+e", "win+i",
    "super+r", "super+x", "super+e", "super+i",
}

RISKY_TEXT_HINTS = [
    "password", "sign in", "log in", "login", "checkout", "pay", "purchase", "buy",
    "delete", "remove", "trash", "format", "factory reset",
    "upload", "post", "send", "email", "message",
    "accept", "agree", "terms", "cookies", "subscribe",
    "download", "install",
]

def classify_action(action: Dict[str, Any]) -> Tuple[bool, str]:
    kind = str(action.get("kind", "")).strip().lower()
    if not kind:
        return False, "Missing action.kind"

    if kind == "key":
        combo = str(action.get("key", "")).strip().lower()
        if combo in BLOCKED_KEY_COMBOS:
            return False, f"Blocked key combo: {combo}"

    return True, "ok"

def requires_desktop(action: Dict[str, Any]) -> bool:
    return str(action.get("kind", "")).strip().lower() in DESKTOP_KINDS

def requires_user_approval(action: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Returns (requires, reason). This is your human-in-the-loop gate.
    """
    kind = str(action.get("kind", "")).strip().lower()

    # Always approve these kinds:
    if kind in {"right_click", "double_click"}:
        return True, f"{kind} requires confirmation"

    if kind == "key":
        combo = str(action.get("key", "")).strip().lower()
        # Enter often submits dialogs/forms
        if "enter" in combo:
            return True, "Key includes Enter (may submit/confirm)"
        if "del" in combo or "delete" in combo:
            return True, "Key includes Delete (destructive risk)"
        # ctrl+w closes tabs, still meaningful
        if combo in {"ctrl+w", "ctrl+shift+w", "ctrl+q", "cmd+q", "super+q"}:
            return True, f"App-close key combo: {combo}"

    if kind == "type":
        text = str(action.get("text", "")).lower()
        if any(h in text for h in RISKY_TEXT_HINTS):
            return True, "Typed text contains high-risk intent"

    # Scroll/mouse_move/left_click are usually fine
    return False, "ok"
