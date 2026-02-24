/**
 * File path utilities (browser-safe, cross-platform).
 */

export const FileUtils = {
  /**
   * Normalize path separators to forward slash.
   */
  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, "/");
  },

  /**
   * Get file extension (without leading dot).
   * Returns "" if no extension.
   */
  getExtension(filePath: string): string {
    const p = this.normalizePath(filePath);
    const base = p.split("/").pop() ?? "";
    const i = base.lastIndexOf(".");
    if (i <= 0 || i === base.length - 1) return "";
    return base.slice(i + 1);
  },

  /**
   * Get file base name without extension.
   * Example: "/a/b/c.test.ts" -> "c.test"
   */
  getBaseName(filePath: string): string {
    const p = this.normalizePath(filePath);
    const base = p.split("/").pop() ?? "";
    const i = base.lastIndexOf(".");
    if (i <= 0) return base; // no ext or dotfile
    return base.slice(0, i);
  },
} as const;
