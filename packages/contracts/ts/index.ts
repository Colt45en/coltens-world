/**
 * @we/contracts
 *
 * Typed contract definitions for Autonomy Loop API.
 *
 * - Generated types: from OpenAPI spec (auto-generated, do not edit)
 * - HTTP client: hand-written wrapper around types
 *
 * Usage:
 *   import { createAutonomyLoopClient } from "@we/contracts";
 *   const client = createAutonomyLoopClient("http://localhost:8001");
 *   const result = await client.runBatch({ ... });
 */

// Re-export all generated types from OpenAPI codegen
// (types.ts will be generated when OpenAPI export runs)
// export * from "./types";

// Re-export client and factory
export {
    AutonomyLoopClient,
    createAutonomyLoopClient,
    type AutonomyLoopConfig
} from "./client";
