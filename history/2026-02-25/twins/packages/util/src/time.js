/**
 * Deterministic time helpers.
 * NOTE: We do NOT expose wall-clock "now()" here on purpose.
 */
export const TimeTools = {
    /**
     * Format an ISO timestamp string.
     * Validates and normalizes to prevent accidental nondeterminism.
     */
    formatTimestamp(isoString) {
        const d = new Date(isoString);
        if (Number.isNaN(d.getTime())) {
            throw new Error(`Invalid timestamp input: "${isoString}"`);
        }
        return d.toISOString();
    },
};
