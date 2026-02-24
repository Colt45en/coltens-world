# World Engine Master Launcher Guide

## Overview

The **Master Launcher** provides a unified way to start all World Engine development services with a single command or button click.

### Services Started

| Service             | Language         | Port | Purpose                              |
| ------------------- | ---------------- | ---- | ------------------------------------ |
| **Nucleus**         | Node.js          | 3000 | WebSocket orchestrator & routing hub |
| **IDE Web**         | TypeScript/React | 5173 | Main IDE frontend (Vite)             |
| **Preview Runtime** | TypeScript       | 5174 | iframe runtime bridge (Vite)         |
| **Python Sidecar**  | Python/FastAPI   | 8001 | Autonomy loop pipeline & AI services |

---

## Quick Start

### Option 1: Command Line (Recommended)

```bash
# Start all services with a single command
pnpm launch

# Or the full name
pnpm launch:complete
```

**What happens:**
- All 4 services start in parallel with staggered initialization
- Each service gets a colored log prefix for easy tracking
- Services finish initializing in ~10 seconds
- Press `Ctrl+C` to gracefully shut down all services

**Output Example:**
```
╔════════════════════════════════════════╗
║   WORLD ENGINE - MASTER LAUNCHER       ║
╚════════════════════════════════════════╝

Services starting in order:
  1. Nucleus WebSocket Hub → ws://localhost:3000
  2. IDE Web (Vite) → http://localhost:5173
  3. Preview Runtime (Vite) → http://localhost:5174
  4. Python Sidecar (FastAPI) → http://localhost:8001
```

### Option 2: VS Code GUI

Open VS Code's **Command Palette** (`Ctrl+Shift+P`) and run:

```
Tasks: Run Task → World Engine: Launch All
```

(Compound task - starts all services in parallel)

### Option 3: IDE Control Panel

1. Open IDE Web: **http://localhost:5173**
2. Click **"System Launcher"** from the main dashboard
3. Click the **"LAUNCH ALL SERVICES"** button
4. Status will show which services are online

---

## Service Access

Once all services are running:

| Service             | URL                        | Purpose                                   |
| ------------------- | -------------------------- | ----------------------------------------- |
| **IDE Web**         | http://localhost:5173      | Main development interface                |
| **Nucleus Hub**     | ws://localhost:3000        | WebSocket connection (auto-used by IDE)   |
| **Preview Runtime** | http://localhost:5174      | Game/simulation preview viewport          |
| **Python API Docs** | http://localhost:8001/docs | FastAPI Swagger UI (interactive API docs) |

---

## How It Works

### Behind the Scenes

The launcher script (`scripts/launch-all.mjs`):

1. **Validates environment** — Checks Node.js, Python, pnpm availability
2. **Starts services sequentially with delays** — Prevents port conflicts and initialization race conditions
3. **Logs each service with color coding** — Makes it easy to track what each service is doing
4. **Handles graceful shutdown** — On `Ctrl+C`, sends SIGTERM to all processes, waits 3 seconds, then SIGKILL if needed
5. **Preserves stdio** — All service logs stream to your terminal in real-time

### Service Status Monitoring

The **System Launcher** UI component:

- Polls all service ports every 5 seconds
- Shows **ONLINE** ✓, **CHECKING** ⏳, or **OFFLINE** ✗ status
- Provides one-click access to each service
- Auto-refreshes when you click "LAUNCH NOW"

---

## Troubleshooting

### ❌ "Port already in use"

```bash
# Find what's using the port (3000 example)
netstat -ano | findstr :3000
# Or on macOS/Linux:
lsof -i :3000

# Kill the process
# Windows:
taskkill /PID <PID> /F
# macOS/Linux:
kill -9 <PID>
```

### ❌ "Python not found"

Install Python 3.9+ and add to PATH:

```bash
# Windows: Download from python.org
# macOS: brew install python
# Linux: sudo apt install python3
```

### ❌ Services start but disconnect after 30 seconds

Check if they're crashing:

```bash
# Run individual service to see error
pnpm --filter ./apps/nucleus run dev
# Check terminal for error messages
```

### ❌ ModuleNotFoundError: No module named 'uvicorn'

Install Python dependencies:

```bash
cd apps/py-sidecar
pip install -r requirements.txt
```

---

## Manual Startup (Individual Services)

If you prefer more control, start services individually:

```bash
# Terminal 1: Nucleus
pnpm --filter ./apps/nucleus run dev

# Terminal 2: IDE Web
pnpm --filter ./apps/ide-web run dev -- --port 5173

# Terminal 3: Preview Runtime
pnpm --filter ./apps/preview-runtime run dev -- --port 5174

# Terminal 4: Python Sidecar
cd apps/py-sidecar
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

---

## Advanced: Customizing the Launcher

### Edit which services start

Open `scripts/launch-all.mjs` and modify the `services` array:

```javascript
const services = [
  // Add/remove/modify services here
  {
    name: "YOUR_SERVICE",
    cmd: "npm",
    args: ["run", "dev"],
    cwd: "path/to/service",
    port: 9999,
    delay: 1000,
  },
];
```

### Change startup order/delays

Modify the `delay` property per service (milliseconds):

```javascript
{
  name: "PYTHON",
  delay: 5000,  // Wait 5 seconds before starting this
}
```

---

## Next Steps

- ✅ **Explore the IDE**: http://localhost:5173
- ✅ **Check service health**: Click **"System Launcher"** tab
- ✅ **Review API docs**: http://localhost:8001/docs
- ✅ **Start building**: See QUICKSTART.md for development workflow

---

## FAQ

**Q: Do I need to run this every time I reboot?**
A: Yes. The launcher starts fresh services each time. Data is persisted in the database, but processes must restart.

**Q: Can I run two instances of the launcher?**
A: No. They'll conflict on the same ports. Use one launcher or start services individually in separate terminals.

**Q: What if a service crashes?**
A: The launcher will show it as disconnected, but won't automatically restart it. You can restart individual services manually.

**Q: How do I see full logs?**
A: All logs stream to the terminal where you ran `pnpm launch`. Important errors typically appear within the first 10 seconds.

**Q: Can I run this on macOS/Linux?**
A: Yes! Both PowerShell-style output and ANSI colors work cross-platform.

---

**Last Updated:** 2026-02-14
**Status:** ✅ Production Ready
