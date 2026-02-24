# World Engine - Automation Index Library Integration Guide

## Overview

The **Automation Index Library** (`@world-engine/automation-index`) is a new centralized hub for all World Engine packages and applications. It provides:

- **Unified Module Registry**: Manage all modules, packages, and applications in one place
- **Dependency Graph Management**: Automatic resolution of module dependencies and circular dependency detection
- **Application Lifecycle Management**: Orchestrated startup, monitoring, and shutdown
- **Health Monitoring**: Built-in health checks and status reporting
- **Automated Discovery**: Dynamic module and application discovery

## Architecture

### Package Structure

```
packages/automation-index/
├── src/
│   ├── index.ts           # Main entry point
│   ├── registry.ts        # Module registry and dependency management
│   ├── automation.ts      # Automation controller and orchestration
│   ├── apps/
│   │   └── index.ts       # Application catalog and lifecycle
│   └── packages/
│       └── index.ts       # Package metadata and registry
└── dist/                  # Compiled TypeScript
```

### Core Components

#### 1. **Module Registry** (`registry.ts`)
Manages all modules with features like:
- Dependency graph tracking
- Circular dependency detection
- Topological sorting for initialization order
- Dynamic module loading and status tracking
- Statistics and introspection

```typescript
import { registry } from "@world-engine/automation-index";

// Get a module
const module = registry.get("@world-engine/protocol");

// Get initialization order
const order = registry.getInitializationOrder();

// Check for circular dependencies
const hasCircular = registry.hasCircularDependencies("my-module");
```

#### 2. **Application Management** (`apps/index.ts`)
Manages application lifecycle with:
- Application registry and discovery
- Status tracking (running, stopped, error)
- Type-based filtering (web, backend, worker, sidecar)
- Dependency management

```typescript
import { APPLICATIONS, getBackendServices, getRunningApps } from "@world-engine/automation-index/apps";

// Get all backend services
const services = getBackendServices();

// Get running apps
const running = getRunningApps();

// Get specific app config
const config = APPLICATIONS["nucleus"];
```

#### 3. **Automation Controller** (`automation.ts`)
Orchestrates the entire ecosystem:
- Parallel/sequential startup
- Health checking
- Retry logic
- Graceful shutdown

```typescript
import { automation, AutomationController } from "@world-engine/automation-index";

// Use global instance
await automation.startup();

// Or create custom instance
const controller = new AutomationController({
  parallelStartup: true,
  maxRetries: 3,
  healthCheckIntervalMs: 5000
});

await controller.startup();
```

## Migration Guide

### Step 1: Update Application package.json

Add the automation-index dependency:

```json
{
  "dependencies": {
    "@world-engine/automation-index": "workspace:*"
  }
}
```

### Step 2: Update Application Startup

**Before:**
```typescript
// apps/nucleus/src/index.ts
import { createServer } from "http";
// ... manual startup code ...
createServer().listen(3000);
```

**After:**
```typescript
// apps/nucleus/src/index.ts
import { automation, registry } from "@world-engine/automation-index";
import { APPLICATIONS } from "@world-engine/automation-index/apps";

// Register the module
registry.register({
  name: "@world-engine/nucleus",
  version: "1.0.0",
  type: "application",
  exports: ["Nucleus", "Router", "Ledger"],
  dependencies: ["@world-engine/ledger-contracts"],
  loaded: false,
  initialized: false
});

// Start the application as part of the automation system
const config = APPLICATIONS["nucleus"];
automation.startApplication(config.name);
```

### Step 3: Create Unified Startup Script

```typescript
// scripts/startup-complete.mjs
import { automation, registry, registerModules } from "@world-engine/automation-index";
import { PACKAGES } from "@world-engine/automation-index/packages";
import { APPLICATIONS } from "@world-engine/automation-index/apps";

// 1. Register all core modules
const modules = [
  { name: "@world-engine/protocol", version: "1.0.0", type: "package", dependencies: [], exports: [] },
  { name: "@world-engine/bus", version: "1.0.0", type: "package", dependencies: ["@world-engine/protocol"], exports: [] },
  // ... more modules ...
];
registerModules(modules);

// 2. Initialize and start
await automation.startup();

// 3. Monitor health
setInterval(async () => {
  const health = await automation.getHealthReport();
  console.log("Health:", health);
}, 5000);
```

### Step 4: Update IDE Integration

For the IDE (ide-web), add module discovery:

```typescript
// apps/ide-web/src/hooks/useModuleRegistry.ts
import { registry } from "@world-engine/automation-index";

export function useModuleRegistry() {
  const [modules, setModules] = React.useState([]);

  React.useEffect(() => {
    setModules(registry.getAll());
  }, []);

  return modules;
}
```

## Exported APIs

### Main Exports (`@world-engine/automation-index`)

```typescript
// Registry management
export { registry, ModuleRegistry, ModuleEntry };
export { registerModules };

// Application management
export * from "./apps/index.js";

// Automation control
export { AutomationController, automation };
export { initializeGlobalAutomation, registerAndMonitor };

// Package metadata
export * from "./packages/index.js";
```

### Sub-exports

#### `@world-engine/automation-index/registry`
```typescript
import { registry } from "@world-engine/automation-index/registry";
```

#### `@world-engine/automation-index/apps`
```typescript
import { APPLICATIONS, getActiveApplications } from "@world-engine/automation-index/apps";
```

#### `@world-engine/automation-index/automation`
```typescript
import { automation, AutomationController } from "@world-engine/automation-index/automation";
```

#### `@world-engine/automation-index/packages`
```typescript
import { PACKAGES } from "@world-engine/automation-index/packages";
```

## Configuration

### AutomationConfig

```typescript
interface AutomationConfig {
  parallelStartup: boolean;        // Start apps in parallel (default: true)
  maxRetries: number;               // Retry count for failed startups (default: 3)
  retryDelayMs: number;             // Delay between retries (default: 1000)
  healthCheckIntervalMs: number;   // Health check frequency (default: 5000)
  enableMetrics: boolean;           // Enable metrics collection (default: true)
}
```

## Applications Registered

The following applications are pre-registered in the index:

### Frontend
- **ide-web** (port 5173) - Web-based IDE
- **avatar-lab** (port 5175) - Avatar creation tool
- **web** (port 5000) - Main web application
- **preview-runtime** (port 5174) - Preview server

### Backend
- **nucleus** (port 3000) - Core orchestrator
- **agent-server** (port 3001) - AI agent WebSocket server
- **sim-server** (port 3002) - Physics simulation server

### Sidecars
- **py-sidecar** (port 8011) - Python microservice

## Best Practices

### 1. Module Registration
Always register modules before initialization:

```typescript
registry.register({
  name: "my-module",
  version: "1.0.0",
  type: "package",
  exports: ["MyClass", "myFunction"],
  dependencies: ["@world-engine/util"],
  loaded: false,
  initialized: false
});
```

### 2. Dependency Management
Check and manage dependencies:

```typescript
// Get all dependencies of a module
const allDeps = registry.getAllDependencies("@world-engine/engine");

// Detect circular dependencies
if (registry.hasCircularDependencies("my-module")) {
  // Handle circular dependency
}

// Get initialization order
const order = registry.getInitializationOrder();
```

### 3. Health Checks
Implement health checks for critical services:

```typescript
automation.setHealthCheck(
  "nucleus",
  async () => {
    const response = await fetch("http://localhost:3000/health");
    return response.ok;
  }
);
```

### 4. Error Handling
Monitor and handle errors gracefully:

```typescript
const stats = automation.getStats();
if (stats.errors.length > 0) {
  console.error("Errors detected:", stats.errors);
  // Take corrective action
}
```

## Example: Complete Application Integration

```typescript
// apps/my-app/src/index.ts
import { automation, registry } from "@world-engine/automation-index";
import { APPLICATIONS } from "@world-engine/automation-index/apps";

async function main() {
  // 1. Register this application
  registry.register({
    name: "@world-engine/my-app",
    version: "1.0.0",
    type: "application",
    exports: ["MyApp"],
    dependencies: ["@world-engine/protocol", "@world-engine/bus"],
    loaded: false,
    initialized: false
  });

  // 2. Mark as loaded
  registry.markLoaded("@world-engine/my-app");

  // 3. Start the app through automation
  await automation.startApplication("my-app");

  // 4. Mark as initialized
  registry.markInitialized("@world-engine/my-app");

  // 5. Setup health check
  automation.setHealthCheck("my-app", async () => {
    // Your health check logic
    return true;
  });

  // 6. Get stats
  console.log("Status:", automation.getStats());
}

main().catch(console.error);
```

## Testing the Integration

### Verify Build
```bash
cd packages/automation-index
pnpm build
```

### Test Registry
```bash
node -e "import { registry } from './dist/index.js'; console.log(registry.getStats())"
```

### Run Full Startup
```bash
pnpm run startup unified
```

## Migration Timeline

1. **Phase 1**: Create automation-index package ✅
2. **Phase 2**: Build automation-index successfully ✅
3. **Phase 3**: Update core applications to use registry
4. **Phase 4**: Implement full startup orchestration
5. **Phase 5**: Add comprehensive health monitoring
6. **Phase 6**: Deploy unified ecosystem

## Troubleshooting

### Module Not Found
- Ensure module is registered before access
- Check workspace configuration
- Verify distfiles are built

### Circular Dependency
- Check `registry.hasCircularDependencies()`
- Refactor dependencies to break cycle
- Use `registry.getAllDependencies()` to find paths

### Application Won't Start
- Check health check results: `automation.getStats().errors`
- Verify port availability
- Check application logs
- Ensure dependencies are running first

## Next Steps

1. Update all applications to use this index
2. Implement comprehensive health monitoring
3. Add metrics and observability
4. Create management dashboard
5. Document for developers

---

**Version**: 1.0.0
**Last Updated**: 2026-02-24
**Status**: Ready for Integration
