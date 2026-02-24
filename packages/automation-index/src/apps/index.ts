/**
 * World Engine Applications Index
 *
 * Registry and metadata for all World Engine applications.
 * Provides application discovery and lifecycle management.
 */

/**
 * Application metadata and configuration
 */
export interface ApplicationConfig {
  name: string;
  displayName: string;
  description: string;
  port?: number;
  type: "web" | "backend" | "worker" | "sidecar";
  status: "active" | "inactive" | "maintenance";
  dependencies?: string[];
  entryPoint?: string;
}

/**
 * Registered applications in the World Engine
 */
export const APPLICATIONS: Record<string, ApplicationConfig> = {
  // Frontend Applications
  "ide-web": {
    name: "ide-web",
    displayName: "IDE Web",
    description: "Web-based IDE for World Engine development and interaction",
    port: 5173,
    type: "web",
    status: "active",
    entryPoint: "apps/ide-web/src/main.tsx",
  },
  "avatar-lab": {
    name: "avatar-lab",
    displayName: "Avatar Lab",
    description: "Avatar creation and manipulation interface",
    port: 5175,
    type: "web",
    status: "active",
    entryPoint: "apps/avatar-lab/src/main.tsx",
  },
  web: {
    name: "web",
    displayName: "Web App",
    description: "Main web application",
    port: 5000,
    type: "web",
    status: "active",
    entryPoint: "apps/web/src/main.tsx",
  },

  // Backend Services
  nucleus: {
    name: "nucleus",
    displayName: "Nucleus",
    description: "Core backend service - main runtime orchestrator",
    port: 3000,
    type: "backend",
    status: "active",
    entryPoint: "apps/nucleus/src/index.ts",
    dependencies: ["ledger-contracts"],
  },
  "agent-server": {
    name: "agent-server",
    displayName: "Agent Server",
    description: "WebSocket server for AI agent communication",
    port: 3001,
    type: "backend",
    status: "active",
    entryPoint: "apps/agent-server/src/index.ts",
  },
  "sim-server": {
    name: "sim-server",
    displayName: "Simulation Server",
    description: "Physics and simulation engine server",
    port: 3002,
    type: "backend",
    status: "active",
    entryPoint: "apps/sim-server/src/index.ts",
  },

  // Worker & Sidecar Services
  "py-sidecar": {
    name: "py-sidecar",
    displayName: "Python Sidecar",
    description: "Python microservice for AI and data processing",
    port: 8011,
    type: "sidecar",
    status: "active",
    entryPoint: "apps/py-sidecar/main.py",
  },
  "preview-runtime": {
    name: "preview-runtime",
    displayName: "Preview Runtime",
    description: "Runtime preview server for experimentation",
    port: 5174,
    type: "web",
    status: "active",
    entryPoint: "apps/preview-runtime/src/main.tsx",
  },
};

/**
 * Get application by name
 */
export function getApplication(name: string): ApplicationConfig | null {
  return APPLICATIONS[name] || null;
}

/**
 * List all active applications
 */
export function getActiveApplications(): ApplicationConfig[] {
  return Object.values(APPLICATIONS).filter((app) => app.status === "active");
}

/**
 * List applications by type
 */
export function getApplicationsByType(
  type: ApplicationConfig["type"]
): ApplicationConfig[] {
  return Object.values(APPLICATIONS).filter((app) => app.type === type);
}

/**
 * Get all backend services
 */
export function getBackendServices(): ApplicationConfig[] {
  return getApplicationsByType("backend");
}

/**
 * Get all web applications
 */
export function getWebApplications(): ApplicationConfig[] {
  return getApplicationsByType("web");
}

/**
 * Application lifecycle states
 */
export type AppStatus = "starting" | "running" | "stopping" | "stopped" | "error";

/**
 * Application process info
 */
export interface AppProcessInfo {
  name: string;
  status: AppStatus;
  pid?: number;
  port?: number;
  uptime?: number;
  lastError?: string;
}

/**
 * Application manager registry
 */
export const APP_REGISTRY = new Map<string, AppProcessInfo>();

/**
 * Register application instance
 */
export function registerApp(info: AppProcessInfo): void {
  APP_REGISTRY.set(info.name, info);
}

/**
 * Unregister application instance
 */
export function unregisterApp(name: string): void {
  APP_REGISTRY.delete(name);
}

/**
 * Update application status
 */
export function updateAppStatus(name: string, status: AppStatus): void {
  const info = APP_REGISTRY.get(name);
  if (info) {
    info.status = status;
  }
}

/**
 * Get running applications
 */
export function getRunningApps(): AppProcessInfo[] {
  return Array.from(APP_REGISTRY.values()).filter((app) => app.status === "running");
}
