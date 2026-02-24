/**
 * World Engine Automation Index Library
 *
 * Central hub for all compiled World Engine packages and applications.
 * Provides unified exports, registry, and automation utilities.
 *
 * @version 1.0.0
 */

// Sub-exports for organization
export * as apps from "./apps/index.js";
export * from "./automation.js";
export * as packages from "./packages/index.js";
export { registerModules, registry, type ModuleEntry, type ModuleRegistry } from "./registry.js";
