/**
 * Browser-only entry point for World Engine
 * Includes renderer and browser-specific modules
 *
 * Usage (in browser contexts):
 *   import { RendererIntentToolkit } from '@world-engine/engine/browser';
 *
 * Server note:
 *   Do NOT import from this module in Node.js server contexts.
 *   Use the main '@world-engine/engine' entry point instead.
 */

// Re-export everything from main
export * from "./index.js";

// Browser-specific exports that require DOM APIs
export { RendererIntentToolkit, type ToolResult as RendererToolResult } from "./tools/renderer-intent-tools";
