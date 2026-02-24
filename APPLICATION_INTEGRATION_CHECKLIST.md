# Complete Application Integration Checklist

## All Applications to Upgrade

### Quick Reference Matrix

| Application | Type | Port | Status | Priority | Template |
|-------------|------|------|--------|----------|----------|
| nucleus | Backend | 3000 | Ready | 🔴 CRITICAL | [INTEGRATION_TEMPLATE_NUCLEUS.md](INTEGRATION_TEMPLATE_NUCLEUS.md) |
| agent-server | Backend | 3001 | Ready | 🟠 HIGH | Template A |
| sim-server | Backend | 3002 | Ready | 🟠 HIGH | Template B |
| ide-web | Frontend | 5173 | Ready | 🟠 HIGH | Template C |
| avatar-lab | Frontend | 5175 | Ready | 🟡 MEDIUM | Template D |
| preview-runtime | Frontend | 5174 | Ready | 🟡 MEDIUM | Template E |
| py-sidecar | Sidecar | 8011 | Ready | 🟡 MEDIUM | Template F |
| web | Frontend | 5000 | Ready | 🟡 MEDIUM | Template G |
| agenthub | Backend | 3003 | Ready | 🟡 MEDIUM | Template H |
| agent-suite | Frontend | 5176 | Ready | 🔵 LOW | Template I |

---

## Backend Application Template (agent-server, sim-server, agenthub)

### File: apps/{app}/src/index.ts

```typescript
import { automation, registry } from "@world-engine/automation-index";
import { APPLICATIONS } from "@world-engine/automation-index/apps";
import express from "express";

const app = express();
const config = APPLICATIONS["{APP_NAME}"];
const PORT = config.port;

async function startup() {
  try {
    console.log(`🚀 Starting {APP_NAME} on port ${PORT}...`);

    // 1. Register module
    registry.register({
      name: `@world-engine/{APP_NAME}`,
      version: "1.0.0",
      type: "application",
      exports: [],
      dependencies: ["@world-engine/protocol"],
      loaded: false,
      initialized: false
    });

    // 2. Initialize your app logic here
    // ... existing startup code ...

    // 3. Mark as loaded
    registry.markLoaded(`@world-engine/{APP_NAME}`);

    // 4. Start server
    const server = app.listen(PORT, () => {
      console.log(`✅ {APP_NAME} listening on port ${PORT}`);
    });

    // 5. Mark as initialized
    registry.markInitialized(`@world-engine/{APP_NAME}`);

    // 6. Register with automation
    automation.registerApp({
      name: "{APP_NAME}",
      status: "running",
      port: PORT,
      pid: process.pid,
      startTime: new Date()
    });

    // 7. Health check
    app.get("/health", (req, res) => {
      res.json({ status: "healthy", timestamp: new Date() });
    });

    // 8. Graceful shutdown
    process.on("SIGINT", () => {
      console.log(`💤 Shutting down {APP_NAME}...`);
      server.close(() => {
        automation.updateAppStatus("{APP_NAME}", "stopped");
        process.exit(0);
      });
    });

  } catch (error) {
    console.error(`❌ Failed to start {APP_NAME}:`, error);
    automation.updateAppStatus("{APP_NAME}", "error");
    process.exit(1);
  }
}

startup();
```

---

## Frontend Application Template (ide-web, avatar-lab, preview-runtime)

### File: apps/{app}/src/main.tsx

```typescript
import { createRoot } from "react-dom/client";
import { registry } from "@world-engine/automation-index";
import { APPLICATIONS } from "@world-engine/automation-index/apps";
import App from "./App";

async function initialize() {
  try {
    console.log("🚀 Initializing {APP_NAME}...");

    // Register with automation-index
    registry.register({
      name: `@world-engine/{APP_NAME}`,
      version: "1.0.0",
      type: "application-frontend",
      exports: ["App"],
      dependencies: [],
      loaded: false,
      initialized: false
    });

    // Mark as loaded
    registry.markLoaded(`@world-engine/{APP_NAME}`);

    // Render app
    const root = createRoot(document.getElementById("root")!);
    root.render(<App />);

    // Mark as initialized
    registry.markInitialized(`@world-engine/{APP_NAME}`);

    console.log(`✅ {APP_NAME} initialized successfully`);

  } catch (error) {
    console.error(`❌ Failed to initialize {APP_NAME}:`, error);
  }
}

initialize();
```

### File: apps/{app}/vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { registry } from "@world-engine/automation-index";

export default defineConfig({
  plugins: [react()],
  server: {
    port: APPLICATIONS["{APP_NAME}"].port,
    strictPort: true
  },
  build: {
    // optimization flags
  }
});
```

---

## Python Sidecar Template (py-sidecar)

### File: apps/py-sidecar/src/main.py

```python
import asyncio
import requests
from fastapi import FastAPI
from typing import Dict, Any

app = FastAPI()

async def register_with_automation():
    """Register Python sidecar with automation-index"""
    try:
        # Register module with nucleus
        registry_data = {
            "name": "@world-engine/py-sidecar",
            "version": "1.0.0",
            "type": "application-sidecar",
            "exports": ["AIOrchestrator", "PythonPipeline"],
            "dependencies": [],
            "loaded": False,
            "initialized": False
        }

        # Send registration to nucleus
        response = requests.post(
            "http://localhost:3000/registry/register",
            json=registry_data
        )

        if response.status_code == 200:
            print("✅ Python sidecar registered with automation-index")
        else:
            print(f"⚠️ Registration failed: {response.status_code}")

    except Exception as e:
        print(f"❌ Registration error: {e}")

@app.on_event("startup")
async def startup():
    """Called when FastAPI starts"""
    print("🚀 Starting py-sidecar...")
    await register_with_automation()
    print("✅ py-sidecar ready")

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "py-sidecar",
        "version": "1.0.0"
    }

@app.get("/registry")
async def get_registry():
    """Get module registry from nucleus"""
    try:
        response = requests.get("http://localhost:3000/registry")
        return response.json()
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)
```

---

## Implementation Order

### Phase 1: Core System (Week 1)
1. ✅ **automation-index** - Created and built
2. 🔴 **nucleus** - Apply template, test startup
3. 🟠 **agent-server** - Apply template, test registration
4. 🟠 **sim-server** - Apply template, test lifecycle

### Phase 2: Frontend Stack (Week 2)
5. 🟠 **ide-web** - Apply template, test module loading
6. 🟡 **preview-runtime** - Apply template, test integration
7. 🟡 **avatar-lab** - Apply template, test initialization

### Phase 3: Extended Ecosystem (Week 3)
8. 🟡 **py-sidecar** - Apply template, test Python registration
9. 🟡 **web** - Apply template, test public app
10. 🔵 **agent-suite** - Apply template, test UI

---

## Automation Script to Update Applications

### File: scripts/integrate-automation-index.sh

```bash
#!/bin/bash

set -e

APPS=(
  "nucleus:backend"
  "agent-server:backend"
  "sim-server:backend"
  "ide-web:frontend"
  "avatar-lab:frontend"
  "preview-runtime:frontend"
  "py-sidecar:python"
  "web:frontend"
  "agenthub:backend"
  "agent-suite:frontend"
)

echo "🚀 Integrating automation-index across all applications..."

for app_type in "${APPS[@]}"; do
  app="${app_type%:*}"
  type="${app_type#*:}"

  echo ""
  echo "📦 Updating $app ($type)..."

  app_dir="apps/$app"

  if [ ! -d "$app_dir" ]; then
    echo "⚠️  $app directory not found, skipping..."
    continue
  fi

  # Update package.json to add dependency
  if grep -q "@world-engine/automation-index" "$app_dir/package.json"; then
    echo "✅ $app already has automation-index dependency"
  else
    echo "📝 Adding automation-index to $app dependencies..."
    # Use pnpm to add (requires manual intervention or jq)
  fi

  echo "✅ $app ready for manual integration"
done

echo ""
echo "✨ All applications prepared for automation-index integration"
echo ""
echo "📋 Next steps:"
echo "  1. Apply templates to each application"
echo "  2. Run: pnpm build"
echo "  3. Test: pnpm run dev"
echo "  4. Verify: curl http://localhost:PORT/health"
```

---

## Verification Checklist Per App

### For Each Application:
```
□ Added @world-engine/automation-index to dependencies
□ Updated entry point (src/index.ts or src/main.tsx)
□ Added module registration
□ Added health check endpoint
□ Added graceful shutdown handling
□ Updated package.json scripts
□ Built successfully (pnpm build)
□ Started successfully (pnpm dev)
□ Health check responding (/health endpoint)
□ Registry integration working (/registry endpoint)
□ Appears in application list (/applications endpoint)
```

---

## Success Criteria

✅ **All 10 applications** successfully integrate automation-index
✅ **Registry** shows all 27 packages loaded
✅ **Module graph** shows correct dependencies
✅ **Startup sequence** follows topological order
✅ **Health checks** all reporting OK
✅ **E2E test** runs all apps through startup/shutdown cycle
✅ **Zero breaking changes** to existing application APIs

---

## Troubleshooting Guide

### Application Won't Start
1. Check if automation-index is imported correctly
2. Verify module registration code is executed early
3. Check for circular dependencies: `registry.hasCircularDependencies()`
4. Review logs for specific error messages

### Health Check Failing
1. Verify health endpoint is implemented
2. Check port availability
3. Confirm dependencies are running
4. Check network connectivity

### Module Not Found in Registry
1. Verify `registry.register()` was called
2. Check module name matches throughout code
3. Ensure registry is initialized before access
4. Check for typos in module names

### Port Conflicts
1. Verify assigned ports in APPLICATIONS config
2. Check for leftover processes: `lsof -i :PORT`
3. Adjust port assignments if needed
4. Restart relevant services

---

## Support & Questions

For issues or questions during integration:

1. **Check** [AUTOMATION_INDEX_GUIDE.md](AUTOMATION_INDEX_GUIDE.md)
2. **Review** application-specific template
3. **Compare** with nucleus implementation [INTEGRATION_TEMPLATE_NUCLEUS.md](INTEGRATION_TEMPLATE_NUCLEUS.md)
4. **Run** build verification: `pnpm run build`
5. **Check** registry stats: Access /registry endpoint

---

**Version**: 1.0.0
**Last Updated**: 2026-02-24
**Total Applications**: 10
**Status**: Templates Complete - Ready for Implementation
