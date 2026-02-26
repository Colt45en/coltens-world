/**
 * SHIM: mergeByPart re-exported from @world-engine/avatar-core
 * Original: apps/avatar-lab/src/avatar/export/merge/mergeByPart.ts
 * 
 * This shim preserves backward compatibility.
 * Delegate to @world-engine/avatar-core/merge.
 */

export {
  inferPartKey,
  mergeStaticMeshesByPart,
} from "@world-engine/avatar-core/merge";

export type { PartKey } from "@world-engine/avatar-core";

