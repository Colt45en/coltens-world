import { useCallback, useEffect, useState } from "react";
import type { LexiconIndex } from "../../lexicon/lexiconIndex.schema";

/**
 * Hook to load and search lexicon index.
 * Stub pattern: IDE provides callback to load actual file.
 */
export function useLexiconIndex(
    indexFilePath: string,
    options?: {
        onLoadIndex?: (path: string) => Promise<LexiconIndex>;
    }
) {
    const [index, setIndex] = useState<LexiconIndex | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            if (!indexFilePath) {
                throw new Error("No index file path provided");
            }

            // Stub: real code calls onLoadIndex callback
            if (options?.onLoadIndex) {
                const data = await options.onLoadIndex(indexFilePath);
                setIndex(data);
            }
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setLoading(false);
        }
    }, [indexFilePath, options?.onLoadIndex]);

    useEffect(() => {
        load();
    }, [load]);

    return { index, loading, error, refetch: load };
}
