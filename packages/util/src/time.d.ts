/**
 * Deterministic time helpers.
 * NOTE: We do NOT expose wall-clock "now()" here on purpose.
 */
export declare const TimeTools: {
    /**
     * Format an ISO timestamp string.
     * Validates and normalizes to prevent accidental nondeterminism.
     */
    readonly formatTimestamp: (isoString: string) => string;
};
//# sourceMappingURL=time.d.ts.map