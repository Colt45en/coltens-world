# 🚀 World Engine - Build & Startup Guide

## Quick Start (Choose One)

### Option 1: Automatic (Easiest - Windows Users)

**Double-click one of these files in Explorer:**

- `setup.bat` — Install dependencies + run type-check + build
- `start-dev.bat` — Setup + launch all 4 services

### Option 2: PowerShell (More Control)

```powershell
# Install dependencies
npm install

# Verify everything compiles
npm run type-check
npm run build

# Start development servers
npm run dev:all

# Or individual services:
npm run dev -w apps/nucleus       # Terminal 1
npm run dev -w apps/ide-web       # Terminal 2
npm run dev -w apps/preview-runtime # Terminal 3
cd apps/py-sidecar && python -m uvicorn app.main:app --port 8001 --reload  # Terminal 4
```

### Option 3: Manual 4-Terminal Setup

**Terminal 1 - Nucleus (Backend):**

```bash
cd apps/nucleus
npm install
npm run dev
# Expected output: "[nucleus] listening http/ws on :3000"
```

**Terminal 2 - IDE Web (Editor):**

```bash
cd apps/ide-web
npm install
npm run dev
# Expected output: "VITE v5.x.x ready in X ms → Local: http://localhost:5173"
```

**Terminal 3 - Preview Runtime (Game Engine):**

```bash
cd apps/preview-runtime
npm install
npm run dev
# Expected output: "VITE v5.x.x ready in X ms → Local: http://localhost:5174"
```

**Terminal 4 - Python Sidecar:**

```bash
cd apps/py-sidecar
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
# Expected output: "Uvicorn running on http://127.0.0.1:8001"
```

Then **open browser to:** <http://localhost:5173>

---

## Dependency Installation Details

### What Gets Installed

**Root level** (`.`):

- `typescript` ^5.6.3
- `chokidar` ^3.6.0 (file watcher)
- `concurrently` ^9.0.0 (run multiple npm scripts)
- `fast-glob` ^3.3.2 (file pattern matching)

**Per App/Package** (via workspace auto-linking):

- `zod` ^3.23.8 (schema validation)
- `ws` ^8.18.0 (WebSocket)
- `node-pty` ^1.0.0 (terminal emulation)
- etc. (see individual package.json files)

### Installation Time

- First install: **3-5 minutes** (downloads 800MB+)
- Subsequent: **30 seconds** (cached)
- On WSL: **Might be slower** (file system I/O)

---

## Build Output Expectations

### Type Check (`npm run type-check`)

✅ **Success:**

```
All packages compiled successfully
```

⚠️ **Warnings OK** (informational, won't block build):

```
Parameter 'data' implicitly has an 'any' type.
```

❌ **Blockers** (must fix):

```
Cannot find module '@we/protocol'
Cannot find name 'process'
```

### Build (`npm run build`)

✅ **Success:**

```
✓ 12 modules built
Done in 8s
```

⚠️ **Warnings OK:**

```
[warn] treeshake but can't determine if external library has side effects
```

❌ **Blockers:**

```
error TS1005: ';' expected
error TS2688: Cannot find type definition file
```

---

## Verification Checklist

After everything completes, verify:

- [ ] `npm install` finished without major errors
- [ ] `npm run type-check` shows green checkmark or just warnings
- [ ] `npm run build` completed successfully
- [ ] All 4 services start without crashing
- [ ] Browser opens to <http://localhost:5173>
- [ ] WebSocket says "connected" in console

---

## Common Issues & Fixes

### "npm: command not found"

- ✅ Reinstall Node.js from <https://nodejs.org>
- ✅ Restart terminal after install
- ✅ Or use native npm instead of WSL

### Port already in use (3000, 5173, etc.)

```bash
# Windows - Kill process on port
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill <PID>
```

### Module not found errors stay after `npm install`

```bash
# Clear cache and reinstall
rm -r node_modules
npm install
npm run build
```

### Python requirements missing

```bash
cd apps/py-sidecar
pip install fastapi uvicorn
```

### Out of disk space

- Check: `npm cache clean --force`
- Frees ~1GB

---

## Development Workflow

Once everything is running:

1. **Edit code** in `apps/*/src/` or `packages/*/src/`
2. **Changes auto-reload** (Vite HMR on port 5173)
3. **Check errors** in VS Code Problems tab
4. **Run type-check** if needed: `npm run type-check`

---

## Next Steps After Startup

### 1. Open IDE

```
http://localhost:5173
```

### 2. Check Console

```javascript
// In browser console, you should see:
console.log("IDE connected to Nucleus");
```

### 3. Test Brain System (Optional)

```javascript
// Send training request
fetch("http://localhost:3000/uee", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    task: { type: "brain_train", inputs: { populationSize: 20 } },
  }),
})
  .then((r) => r.json())
  .then((d) => console.log(d));
```

---

## Scripts Reference

```bash
npm run dev                    # Start Nucleus only
npm run dev:all               # Start all 4 services (concurrently)
npm run dev:py                # Start Python sidecar
npm run type-check            # Type check all code
npm run build                 # Build all packages
npm run audit:imports         # Check for circular dependencies
npm run audit:imports:watch   # Watch for import issues
```

---

## Documentation

- **Full Setup**: [SETUP.md](SETUP.md)
- **Project Status**: [FINAL_STATUS.md](FINAL_STATUS.md)
- **Windows Issues**: [WINDOWS_SETUP_ISSUE.md](WINDOWS_SETUP_ISSUE.md)
- **Brain System**: [docs/BRAIN_SYSTEM.md](docs/BRAIN_SYSTEM.md)
- **UEE Protocol**: [docs/UEE_INTEGRATION.md](docs/UEE_INTEGRATION.md)

---

## Ready? 🎮

**Run:** `.\setup.bat` or `npm run dev:all`

**Then:** Open <http://localhost:5173>

Let's build! 🚀
