/**
 * World Engine Automation Utilities
 *
 * High-level automation and orchestration utilities for managing
 * the entire World Engine ecosystem.
 */

import { APPLICATIONS, getActiveApplications, type ApplicationConfig } from "./apps/index.js";
import { registry } from "./registry.js";

/**
 * Automation configuration
 */
export interface AutomationConfig {
  parallelStartup: boolean;
  maxRetries: number;
  retryDelayMs: number;
  healthCheckIntervalMs: number;
  enableMetrics: boolean;
}

/**
 * Default automation config
 */
export const DEFAULT_CONFIG: AutomationConfig = {
  parallelStartup: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  healthCheckIntervalMs: 5000,
  enableMetrics: true,
};

/**
 * Automation stats
 */
export interface AutomationStats {
  startTime: number;
  duration: number;
  modulesLoaded: number;
  applicationsRunning: number;
  errors: string[];
}

/**
 * World Engine Automation Controller
 */
export class AutomationController {
  private config: AutomationConfig;
  private stats: AutomationStats;
  private healthChecks = new Map<string, NodeJS.Timeout>();

  constructor(config: Partial<AutomationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      startTime: Date.now(),
      duration: 0,
      modulesLoaded: 0,
      applicationsRunning: 0,
      errors: [],
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): AutomationConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats(): AutomationStats {
    return {
      ...this.stats,
      duration: Date.now() - this.stats.startTime,
    };
  }

  /**
   * Initialize all modules
   */
  async initializeModules(): Promise<void> {
    const order = registry.getInitializationOrder();

    for (const moduleName of order) {
      const module = registry.get(moduleName);
      if (!module) continue;

      try {
        registry.markLoaded(moduleName);
        registry.markInitialized(moduleName);
        this.stats.modulesLoaded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.stats.errors.push(`Failed to initialize ${moduleName}: ${msg}`);
      }
    }
  }

  /**
   * Start an application
   */
  async startApplication(appName: string): Promise<void> {
    const app = APPLICATIONS[appName];
    if (!app) {
      throw new Error(`Application not found: ${appName}`);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Simulation: mark as running
        this.stats.applicationsRunning++;
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.config.maxRetries - 1) {
          await this.sleep(this.config.retryDelayMs);
        }
      }
    }

    throw lastError || new Error(`Failed to start application: ${appName}`);
  }

  /**
   * Start all applications
   */
  async startAllApplications(): Promise<void> {
    const apps = getActiveApplications();

    if (this.config.parallelStartup) {
      await Promise.allSettled(apps.map((app) => this.startApplication(app.name)));
    } else {
      for (const app of apps) {
        try {
          await this.startApplication(app.name);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.stats.errors.push(msg);
        }
      }
    }
  }

  /**
   * Stop an application
   */
  async stopApplication(appName: string): Promise<void> {
    this.clearHealthCheck(appName);
    // Simulation: mark as stopped
    this.stats.applicationsRunning = Math.max(0, this.stats.applicationsRunning - 1);
  }

  /**
   * Stop all applications
   */
  async stopAllApplications(): Promise<void> {
    const apps = getActiveApplications();
    for (const app of apps) {
      try {
        await this.stopApplication(app.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.stats.errors.push(msg);
      }
    }
  }

  /**
   * Set up health check for an application
   */
  setHealthCheck(appName: string, callback: () => Promise<boolean>): void {
    if (this.healthChecks.has(appName)) {
      return; // Already checking
    }

    const check = setInterval(async () => {
      try {
        const healthy = await callback();
        if (!healthy) {
          this.stats.errors.push(`Health check failed for ${appName}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.stats.errors.push(`Health check error for ${appName}: ${msg}`);
      }
    }, this.config.healthCheckIntervalMs);

    this.healthChecks.set(appName, check);
  }

  /**
   * Clear health check
   */
  clearHealthCheck(appName: string): void {
    const check = this.healthChecks.get(appName);
    if (check) {
      clearInterval(check);
      this.healthChecks.delete(appName);
    }
  }

  /**
   * Clear all health checks
   */
  clearAllHealthChecks(): void {
    for (const [appName] of this.healthChecks) {
      this.clearHealthCheck(appName);
    }
  }

  /**
   * Full startup sequence
   */
  async startup(): Promise<void> {
    try {
      await this.initializeModules();
      await this.startAllApplications();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.stats.errors.push(`Startup failed: ${msg}`);
      throw err;
    }
  }

  /**
   * Full shutdown sequence
   */
  async shutdown(): Promise<void> {
    try {
      this.clearAllHealthChecks();
      await this.stopAllApplications();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.stats.errors.push(`Shutdown error: ${msg}`);
    }
  }

  /**
   * Get health report
   */
  async getHealthReport(): Promise<Record<string, any>> {
    return {
      timestamp: new Date().toISOString(),
      status: this.stats.errors.length === 0 ? "healthy" : "degraded",
      stats: this.getStats(),
      registry: registry.getStats(),
      applications: Object.entries(APPLICATIONS).map(([name, app]) => ({
        name,
        status: app.status,
        port: app.port,
      })),
    };
  }

  /**
   * Helper: sleep for ms milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Global automation controller instance
 */
export const automation = new AutomationController();

/**
 * Initialize global automation
 */
export async function initializeGlobalAutomation(config?: Partial<AutomationConfig>): Promise<void> {
  const controller = new AutomationController(config);
  await controller.startup();
}

/**
 * Helper to register and monitor an application
 */
export function registerAndMonitor(app: ApplicationConfig): void {
  // Register in APPLICATIONS (would normally be in apps/index.ts)
  registry.register({
    name: app.name,
    version: "1.0.0",
    type: "application",
    exports: [],
    dependencies: app.dependencies || [],
    loaded: false,
    initialized: false,
  });
}
