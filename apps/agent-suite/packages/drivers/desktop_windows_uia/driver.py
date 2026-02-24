from __future__ import annotations

import platform
from dataclasses import dataclass


@dataclass
class NotepadDemoResult:
    ok: bool
    detail: str


def notepad_demo() -> NotepadDemoResult:
    """
    Safe Windows UI Automation demo:
    - starts Notepad
    - types text into the editor
    - does NOT close or save (non-destructive)
    """
    if platform.system().lower() != "windows":
        return NotepadDemoResult(ok=False, detail="Notepad demo is Windows-only")

    try:
        from pywinauto.application import Application  # type: ignore
    except Exception:
        return NotepadDemoResult(
            ok=False,
            detail="pywinauto not installed. Install: pip install -r requirements-windows.txt",
        )

    app = Application(backend="uia").start("notepad.exe")
    win = app.window(title_re=".*Notepad.*")
    win.wait("visible", timeout=8)

    editor = win.child_window(title="Text Editor", control_type="Document")
    editor.wait("ready", timeout=8)
    editor.type_keys(
        "Hello from Agent-GUI!{ENTER}"
        "This text was typed via Windows UI Automation (UIA) ✅{ENTER}"
        "Safe-by-default: no save, no close, no destructive actions.{ENTER}",
        with_spaces=True,
    )

    return NotepadDemoResult(ok=True, detail="Notepad automated successfully (safe, non-destructive)")
