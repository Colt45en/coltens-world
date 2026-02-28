/**
 * SHIM: bakeMorphTargets re-exported from @world-engine/avatar-core
 * Original: apps/avatar-lab/src/avatar/export/bakeMorphTargets.ts
 *
 * This shim preserves the original API while delegating to the core package.
 * Can be removed once all imports are updated to use @world-engine/avatar-core directly.
 */

// Core implementation
// Convenience wrapper for backward compat: in-place mesh mutation
import type { BakeMorphOptions } from "@world-engine/avatar-core";
import { bakeMorphTargetsInMesh as bakeMorphTargets_Core } from "@world-engine/avatar-core";
import type * as THREE from "three";

export { bakeMorphTargets, bakeMorphTargetsInMesh } from "@world-engine/avatar-core";

/**
 * Legacy function name (in-place mesh mutation).
 * Use for React/Three.js scene updates.
 */
export function bakeMorphTargetsIntoGeometry(
  mesh: THREE.Mesh | THREE.SkinnedMesh,
  opts: BakeMorphOptions = {}
): void {
  bakeMorphTargets_Core(mesh, opts);
}
