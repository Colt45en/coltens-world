/**
 * Package path utilities (browser-safe).
 */

import { FileUtils } from "./fileUtils";

export const PathTools = {
  /**
   * Extract package name from a file path.
   * Prefers "packages/<name>/" segment if present.
   */
  parsePackageName(filePath: string): string {
    const p = FileUtils.normalizePath(filePath);
    const parts = p.split("/").filter(Boolean);

    const pkgIdx = parts.indexOf("packages");
    if (pkgIdx >= 0 && parts[pkgIdx + 1]) return parts[pkgIdx + 1]!;

    if (parts.length >= 2) return parts[parts.length - 2]!;
    return parts[parts.length - 1] ?? "unknown";
  },
} as const;
