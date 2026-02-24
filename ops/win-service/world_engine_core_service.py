from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

import win32event
import win32service
import win32serviceutil
import servicemanager


ROOT = Path(__file__).resolve().parents[2]  # world-engine/
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

PY = sys.executable  # python.exe running the service

def spawn_uvicorn(module: str, host: str, port: int, out_name: str):
    out = (LOG_DIR / f"{out_name}.out.log").open("a", encoding="utf-8")
    err = (LOG_DIR / f"{out_name}.err.log").open("a", encoding="utf-8")
    args = [
        PY, "-m", "uvicorn",
        module,
        "--host", host,
        "--port", str(port),
        "--workers", "1",
        "--log-level", "info",
    ]
    return subprocess.Popen(args, cwd=str(ROOT), stdout=out, stderr=err, creationflags=subprocess.CREATE_NO_WINDOW)

class WorldEngineCoreSvc(win32serviceutil.ServiceFramework):
    _svc_name_ = "WorldEngineCoreSvc"
    _svc_display_name_ = "World Engine Core (Chat+Tools)"
    _svc_description_ = "Runs World Engine chat WebSocket (3000) and tool server (3001) as a supervised Windows Service."

    def __init__(self, args):
        super().__init__(args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.procs: list[subprocess.Popen] = []

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        servicemanager.LogInfoMsg("WorldEngineCoreSvc stopping...")

        for p in self.procs:
            try:
                p.terminate()
            except Exception:
                pass

        time.sleep(1.0)
        for p in self.procs:
            try:
                p.kill()
            except Exception:
                pass

    def SvcDoRun(self):
        servicemanager.LogInfoMsg("WorldEngineCoreSvc starting...")

        # Start chat + tool servers
        self.procs = [
            spawn_uvicorn("ops.servers.chat_server:app", "127.0.0.1", 3000, "chat_3000"),
            spawn_uvicorn("ops.servers.tool_server:app", "127.0.0.1", 3001, "tools_3001"),
        ]

        # Wait for stop
        win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)

if __name__ == "__main__":
    win32serviceutil.HandleCommandLine(WorldEngineCoreSvc)
