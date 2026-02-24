# Nucleus Application Integration Template

## Overview

This template shows how to integrate the Automation Index library into the `nucleus` application.

## Files to Update

### 1. Update package.json

```json
{
  "name": "@world-engine/nucleus",
  "version": "1.0.0",
  "type": "module",
  "description": "World Engine Core Orchestrator",
  "dependencies": {
    "@world-engine/automation-index": "workspace:*",
    "@world-engine/ledger-contracts": "workspace:*",
    "@world-engine/protocol": "workspace:*",
    "@world-engine/bus": "workspace:*",
    "@world-engine/engine": "workspace:*",
    "express": "^4.21.1"
  },
  "scripts": {
    "dev": "node --enable-source-maps src/index.ts",
    "build": "tsc",
    "register": "node scripts/register-module.mjs"
  }
}
```

### 2. Create Module Registration Script

**File**: `apps/nucleus/scripts/register-module.mjs`

```javascript
import { fileURLToPath } from "url";
import { dirname } from "path";
import { registry } from "@world-engine/automation-index";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Register nucleus module with automation-index
registry.register({
  name: "@world-engine/nucleus",
  version: "1.0.0",
  type: "application",
  exports: [
    "Nucleus",
    "NucleusRouter",
    "LedgerController",
    "FlowStateController",
    "AgentController"
  ],
  dependencies: [
    "@world-engine/ledger-contracts",
    "@world-engine/protocol",
    "@world-engine/bus"
  ],
  loaded: false,
  initialized: false
});

console.log("✅ Nucleus module registered with automation-index");
```

### 3. Update Main Entry Point

**File**: `apps/nucleus/src/index.ts`

```typescript
import express from "express";
import { automation, registry } from "@world-engine/automation-index";
import { APPLICATIONS } from "@world-engine/automation-index/apps";

// Import your existing controllers
import { Nucleus } from "./Nucleus.js";
import { setupRoutes } from "./routes/index.js";

const app = express();
const PORT = APPLICATIONS["nucleus"].port || 3000;

async function initializeDependencies() {
  // Initialize ledger contracts
  registry.markLoaded("@world-engine/ledger-contracts");
  registry.markInitialized("@world-engine/ledger-contracts");

  // Initialize protocol
  registry.markLoaded("@world-engine/protocol");
  registry.markInitialized("@world-engine/protocol");

  // Initialize bus
  registry.markLoaded("@world-engine/bus");
  registry.markInitialized("@world-engine/bus");
}

async function startNucleus() {
  try {
    console.log("🚀 Starting Nucleus (Core Orchestrator)...");

    // 1. Initialize dependencies
    await initializeDependencies();

    // 2. Initialize Nucleus
    const nucleus = new Nucleus();
    await nucleus.init();

    // 3. Setup Express routes
    setupRoutes(app, nucleus);

    // 4. Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`✅ Nucleus running on http://localhost:${PORT}`);
    });

    // 5. Mark as loaded and initialized
    registry.markLoaded("@world-engine/nucleus");
    registry.markInitialized("@world-engine/nucleus");

    // 6. Register with automation-index
    automation.registerApp({
      name: "nucleus",
      status: "running",
      port: PORT,
      pid: process.pid,
      startTime: new Date()
    });

    // 7. Setup health check
    setupHealthCheck(nucleus);

    // 8. Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("💤 Shutting down Nucleus...");
      await nucleus.shutdown();
      server.close(() => {
        automation.updateAppStatus("nucleus", "stopped");
        process.exit(0);
      });
    });

  } catch (error) {
    console.error("❌ Failed to start Nucleus:", error);
    automation.updateAppStatus("nucleus", "error");
    process.exit(1);
  }
}

function setupHealthCheck(nucleus: Nucleus) {
  automation.setHealthCheck("nucleus", async () => {
    try {
      // Check health of core systems
      const isLedgerHealthy = await nucleus.checkLedgerHealth();
      const isBusHealthy = await nucleus.checkBusHealth();
      const areControllersHealthy = await nucleus.checkControllerHealth();

      return isLedgerHealthy && isBusHealthy && areControllersHealthy;
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  });
}

// Start the application
startNucleus().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

### 4. Update Routes Handler

**File**: `apps/nucleus/src/routes/index.ts`

```typescript
import express from "express";
import { registry } from "@world-engine/automation-index";
import { APPLICATIONS } from "@world-engine/automation-index/apps";
import { Nucleus } from "../Nucleus.js";

export function setupRoutes(app: express.Application, nucleus: Nucleus) {
  // Health check endpoint
  app.get("/health", (req, res) => {
    const stats = registry.getStats();
    res.json({
      status: "healthy",
      timestamp: new Date(),
      modules: stats.totalModules,
      initialized: stats.initializedModules,
      errors: stats.errors.length
    });
  });

  // Registry info endpoint
  app.get("/registry", (req, res) => {
    const stats = registry.getStats();
    res.json(stats);
  });

  // Applications endpoint
  app.get("/applications", (req, res) => {
    const apps = Object.values(APPLICATIONS);
    res.json(apps);
  });

  // Nucleus-specific routes
  app.get("/flowstate/:id", nucleus.getFlowState.bind(nucleus));
  app.post("/flowstate/:id/compute", nucleus.computeFlowState.bind(nucleus));

  // Your other routes...
  app.use("/api", require("./api.js").default);
}
```

## Integration Checklist

- [ ] Add `@world-engine/automation-index` to dependencies
- [ ] Update package.json scripts
- [ ] Create module registration script
- [ ] Update main entry point (src/index.ts)
- [ ] Update routes to include health checks
- [ ] Test startup: `pnpm --filter @world-engine/nucleus run dev`
- [ ] Verify module appears in registry
- [ ] Check health endpoints responding
- [ ] Test graceful shutdown (CTRL+C)

## Testing

### Test Local Startup
```bash
cd apps/nucleus
pnpm install
pnpm build
pnpm dev
```

### Verify Integration
```bash
# In another terminal
curl http://localhost:3000/health
curl http://localhost:3000/registry
curl http://localhost:3000/applications
```

## Migration Status

- **Phase**: Integration Ready
- **Dependencies**: ✅ All build successfully
- **Registry**: ✅ Automation-index ready
- **Template**: ✅ Complete
- **Next**: Apply to other applications

---

**Template Version**: 1.0.0
**Application**: Nucleus
**Status**: Ready for Implementation
