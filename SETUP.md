# World Engine - Setup & Run Guide

## Prerequisites

Before starting, ensure you have installed:

1. **Node.js** (v18+) - [Download](https://nodejs.org)

   ```bash
   node -v  # Should be v18.0.0 or higher
   ```

2. **Python** (v3.10+) - [Download](https://www.python.org)

   ```bash
   python --version  # Should be 3.10+
   ```

3. **Java** (v17+) - [Download](https://www.oracle.com/java/technologies/downloads/)

   ```bash
   java -version  # Should be 17.0.0 or higher
   ```

4. **pnpm** (recommended package manager)

   ```bash
  pnpm -v
   ```

## Quick Start (Windows)

### Option 0: Deterministic Bootstrap (Recommended)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-project.ps1
```

Then launch services from VS Code task runner using:

- `World Engine: Dev Core (nucleus+ide+sidecar)`
- `World Engine: Dev All (tasks)`

### Option 1: Using Batch Script (Recommended)

1. Double-click `start-dev.bat` in the project root
2. Four terminal windows will open automatically
3. IDE will open in your default browser at `http://localhost:5173`

### Option 2: Manual Start

Open 4 separate terminal windows in the project root:

**Terminal 1 - Nucleus (Node.js Backend)**

```bash
pnpm --filter ./apps/nucleus run dev
```

**Terminal 2 - IDE Web (Vite Editor)**

```bash
pnpm --filter ./apps/ide-web run dev
```

**Terminal 3 - Preview Runtime (Game Engine)**

```bash
pnpm --filter ./apps/preview-runtime run dev -- --port 5174
```

**Terminal 4 - Python Sidecar (Math/NLP Server)**

```bash
cd apps/py-sidecar && python -m uvicorn app.main:app --host 127.0.0.1 --port 8011 --reload
```

Wait ~10 seconds for all to start, then open browser: **http://localhost:5173**

## Setup Process (First Time)

### 1. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

This installs root dependencies and all workspace packages (apps/_, packages/_).

### 2. Verify TypeScript

```bash
pnpm run type-check
```

This checks all TypeScript files for errors without building output.

### 3. Build All Packages

```bash
pnpm run build
```

This compiles all TypeScript packages to `dist/` directories.

### 4. (Optional) Audit Imports

```bash
pnpm run audit:imports
```

This checks for circular dependencies and import/export issues.

## Architecture Overview

### Services & Ports

| Service             | Port | Purpose                                         |
| ------------------- | ---- | ----------------------------------------------- |
| **Nucleus**         | 3000 | Node.js backend, WebSocket hub, message routing |
| **IDE Web**         | 5173 | Vite dev server, editor UI                      |
| **Preview Runtime** | 5174 | Game engine renderer (Three.js)                 |
| **Python Sidecar**  | 8011 | FastAPI server for math/NLP evaluation          |

### Workspace Structure

```text
world-engine/
├── apps/
│   ├── nucleus/          # ✅ Node.js backend (WebSocket, routing, handlers)
│   ├── ide-web/          # ✅ Vite editor (TypeScript, xTerm UI)
│   ├── preview-runtime/  # ✅ Game engine (Three.js, simulation)
│   └── py-sidecar/       # ✅ FastAPI Python server
├── packages/
│   ├── protocol/         # ✅ UEE-1 + Bus envelope schemas (Zod)
│   ├── bus/              # ✅ Event bus with pub/sub
│   ├── engine/           # ✅ ECS runtime + collision
│   ├── graphics/         # ✅ Three.js renderer
│   ├── math/             # ✅ Math primitives (Vec3, RNG, etc)
│   ├── lexicon/          # ✅ Semantic DB layer
│   ├── codex/            # ✅ System config (validation + registry)
│   ├── brain/            # ✅ Neural network + genetic algorithms
│   ├── assets/           # ✅ Resource loader
│   └── tooling/          # ✅ Build utilities
├── scripts/
│   └── import-export-tracker.mjs  # Circular dependency checker
├── docs/
│   ├── BRAIN_SYSTEM.md            # Neural network + evolution
│   ├── UEE_INTEGRATION.md         # Protocol integration guide
│   ├── UEE_QUICK_REFERENCE.md     # Quick API reference
│   └── ...
└── start-dev.bat         # Windows startup script
```

## Communication Flow

### Message Bus (UEE-1 Protocol)

All cross-service communication uses **Unified Engine Envelope (UEE-1)**:

```typescript
// IDE sends task to Nucleus
{
  type: "brain_control",
  messageId: "msg-123",
  payload: {
    agentId: "player-1",
    sensors: { position, health, ... }
  }
}

// Nucleus routes to handler, returns response
{
  ok: true,
  outputs: { actions: { moveForward: 0.7, ... } }
}
```

### WebSocket Connection (Nucleus ↔ IDE/Preview)

- **IDE** → Nucleus: Send tasks, commands, file edits
- **Nucleus** → IDE: Events (file changes, sim status, logs)
- **Nucleus** → Preview: Engine state, scene updates
- **Preview** → Nucleus: Tick updates, performance metrics

## Brain System Features

### Neural Network Training

```bash
# Send training task to Nucleus
POST /uee

{
  type: "brain_train",
  inputs: {
    populationSize: 100,
    generations: 50,
    fitnessFunction: "survive"
  }
}
```

### Real-time Agent Control

```bash
# Send sensor data, get actions back
POST /uee

{
  type: "brain_control",
  inputs: {
    agentId: "player-1",
    sensors: { health: 0.8, position: {...} }
  }
}

# Response
{
  outputs: {
    actions: { moveForward: 0.7, turn: 0.2, ... }
  }
}
```

## Development Workflow

### 1. Make Code Changes

Edit files in `packages/*/src/` or `apps/*/src/`

### 2. TypeScript Auto-Compiles

Each dev server watches for changes:

- Nucleus: `tsx watch src/index.ts`
- IDE: `vite` (HMR enabled)
- Preview: `vite` (HMR enabled)
- Python: `--reload` flag

### 3. Browser Auto-Refreshes

Vite provides Hot Module Replacement (HMR) for instant UI updates.

### 4. Check Errors

Terminal shows compilation errors in real-time.

## Troubleshooting

### "Cannot find module '@we/...' errors"

**Issue**: TypeScript can't resolve workspace packages
**Solution**:

1. Run `pnpm install --frozen-lockfile` again
2. Check `tsconfig.json` has proper `"paths"` mapping
3. Ensure all packages have `package.json` and `src/index.ts`

### Vite Port Already in Use

**Issue**: Port 5173 or 5174 already in use
**Solution**:

```bash
# Change port in vite.config.ts
server: { port: 5175 }
```

Or kill the process using the port:

```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :5173
kill <PID>
```

### Python Sidecar Not Starting

**Issue**: `ModuleNotFoundError: No module named 'fastapi'`
**Solution**:

```bash
# Create virtual environment (optional but recommended)
cd apps/py-sidecar
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt
# If no requirements.txt, install manually:
pip install fastapi uvicorn
```

### WebSocket Connection Refused

**Issue**: IDE can't connect to Nucleus at ws://localhost:3000
**Solution**:

1. Ensure Nucleus is running: `pnpm --filter ./apps/nucleus run dev`
2. Check port 3000 is available: `netstat -ano | findstr :3000`
3. Nucleus ready message should appear: `[nucleus] listening http/ws on :3000`

### Build Fails with "tsconfig.base.json not found"

**Issue**: TypeScript can't find base tsconfig
**Solution**:

```bash
# Verify at project root
ls tsconfig.json
ls tsconfig.base.json  # Should exist
```

If missing, recreate:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "noEmit": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@we/*": ["packages/*/src"]
    }
  }
}
```

## Performance Tips

1. **Close unused services** - Only run what you need
2. **Use production build** - `pnpm run build` for benchmarking
3. **Monitor memory** - Large populations can use >500MB
4. **Cache neural networks** - Save trained networks as JSON

## Next Steps

After startup succeeds:

1. **Explore the IDE** - Edit files, run commands in terminal
2. **Train a brain** - Send `brain_train` task, watch convergence
3. **Control agents** - Send `brain_control` tasks to move game entities
4. **Generate scenes** - Use `scene` task type for procedural generation
5. **Query lexicon** - Use `lexicon_op` for semantic searches

## Documentation

- [Brain System Guide](./docs/BRAIN_SYSTEM.md) - Neural network + evolution
- [UEE Integration](./docs/UEE_INTEGRATION.md) - Protocol specification
- [Quick Reference](./docs/UEE_QUICK_REFERENCE.md) - API reference
- [Architecture Overview](./docs/spec/ARCHITECTURE.md) - System design

## Support

For issues:

1. Check terminal logs for error messages
2. Run `pnpm run audit:imports` to check for circular deps
3. Run `pnpm run type-check` to validate all types
4. Restart all services if stuck
