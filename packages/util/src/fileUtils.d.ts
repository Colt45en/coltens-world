/**
 * File path utilities (browser-safe, cross-platform).
 */
export declare const FileUtils: {
    /**
     * Normalize path separators to forward slash.
     */
    readonly normalizePath: (filePath: string) => string;
    /**
     * Get file extension (without leading dot).
     * Returns "" if no extension.
     */
    readonly getExtension: (filePath: string) => string;
    /**
     * Get file base name without extension.
     * Example: "/a/b/c.test.ts" -> "c.test"
     */
    readonly getBaseName: (filePath: string) => string;
};
//# sourceMappingURL=fileUtils.d.ts.map