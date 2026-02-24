/**
 * World Engine Module Registry
 *
 * Central registry for all compiled modules, enabling dynamic discovery,
 * dependency management, and runtime introspection.
 */

/**
 * Module metadata entry
 */
export interface ModuleEntry {
  name: string;
  version: string;
  type: "package" | "application" | "plugin";
  exports: string[];
  dependencies: string[];
  loaded: boolean;
  initialized: boolean;
  lastAccess?: number;
}

/**
 * Module registry
 */
export class ModuleRegistry {
  private modules = new Map<string, ModuleEntry>();
  private dependencyGraph = new Map<string, Set<string>>();
  private reverseDependencyGraph = new Map<string, Set<string>>();

  /**
   * Register a module
   */
  register(entry: ModuleEntry): void {
    this.modules.set(entry.name, entry);

    // Build dependency graphs
    for (const dep of entry.dependencies) {
      if (!this.dependencyGraph.has(entry.name)) {
        this.dependencyGraph.set(entry.name, new Set());
      }
      this.dependencyGraph.get(entry.name)!.add(dep);

      if (!this.reverseDependencyGraph.has(dep)) {
        this.reverseDependencyGraph.set(dep, new Set());
      }
      this.reverseDependencyGraph.get(dep)!.add(entry.name);
    }
  }

  /**
   * Get a module by name
   */
  get(name: string): ModuleEntry | null {
    return this.modules.get(name) || null;
  }

  /**
   * Get all modules
   */
  getAll(): ModuleEntry[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get modules by type
   */
  getByType(type: ModuleEntry["type"]): ModuleEntry[] {
    return this.getAll().filter((m) => m.type === type);
  }

  /**
   * Get loaded modules
   */
  getLoaded(): ModuleEntry[] {
    return this.getAll().filter((m) => m.loaded);
  }

  /**
   * Get uninitialized modules
   */
  getUninitialized(): ModuleEntry[] {
    return this.getAll().filter((m) => !m.initialized && m.loaded);
  }

  /**
   * Mark module as loaded
   */
  markLoaded(name: string): void {
    const mod = this.get(name);
    if (mod) {
      mod.loaded = true;
      mod.lastAccess = Date.now();
    }
  }

  /**
   * Mark module as initialized
   */
  markInitialized(name: string): void {
    const mod = this.get(name);
    if (mod) {
      mod.initialized = true;
      mod.lastAccess = Date.now();
    }
  }

  /**
   * Get direct dependencies of a module
   */
  getDependencies(name: string): Set<string> {
    return this.dependencyGraph.get(name) || new Set();
  }

  /**
   * Get modules that depend on this module
   */
  getDependents(name: string): Set<string> {
    return this.reverseDependencyGraph.get(name) || new Set();
  }

  /**
   * Get transitive closure of dependencies (all dependencies recursively)
   */
  getAllDependencies(name: string, visited = new Set<string>()): Set<string> {
    if (visited.has(name)) return new Set();
    visited.add(name);

    const result = new Set<string>();
    const direct = this.getDependencies(name);

    for (const dep of direct) {
      result.add(dep);
      const transitive = this.getAllDependencies(dep, visited);
      for (const t of transitive) {
        result.add(t);
      }
    }

    return result;
  }

  /**
   * Check for circular dependencies
   */
  hasCircularDependencies(name: string, visited = new Set<string>(), rec = new Set<string>()): boolean {
    visited.add(name);
    rec.add(name);

    for (const dep of this.getDependencies(name)) {
      if (!visited.has(dep)) {
        if (this.hasCircularDependencies(dep, visited, rec)) {
          return true;
        }
      } else if (rec.has(dep)) {
        return true;
      }
    }

    rec.delete(name);
    return false;
  }

  /**
   * Get initialization order (topological sort)
   */
  getInitializationOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      visited.add(name);

      for (const dep of this.getDependencies(name)) {
        visit(dep);
      }

      order.push(name);
    };

    for (const module of this.modules.keys()) {
      visit(module);
    }

    return order;
  }

  /**
   * Get statistics
   */
  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      packages: this.getByType("package").length,
      applications: this.getByType("application").length,
      plugins: this.getByType("plugin").length,
      loaded: this.getLoaded().length,
      initialized: all.filter((m) => m.initialized).length,
      uninitialized: this.getUninitialized().length,
    };
  }

  /**
   * Clear registry
   */
  clear(): void {
    this.modules.clear();
    this.dependencyGraph.clear();
    this.reverseDependencyGraph.clear();
  }
}

/**
 * Global module registry instance
 */
export const registry = new ModuleRegistry();

/**
 * Helper function to bulk register modules
 */
export function registerModules(entries: ModuleEntry[]): void {
  for (const entry of entries) {
    registry.register(entry);
  }
}
