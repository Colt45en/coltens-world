import { useCallback, useEffect, useState } from "react";

export type StatByKey = { key: string; count: number };

export type MemoryStatsData = {
    schema: { name: string; version: string };
    file: string;
    filters: {
        since: string | null;
        until: string | null;
        top: number;
    };
    meta: {
        scannedLines: number;
        parsedArtifacts: number;
        includedArtifacts: number;
    };
    counts: {
        totalArtifacts: number;
        byDay: StatByKey[];
        topOperators: StatByKey[];
        topConcepts: StatByKey[];
    };
};

export type MemoryStatsError = {
    code: "not_found" | "parse_error" | "cli_error" | "unknown";
    message: string;
};

/**
 * Hook to fetch memory stats from CLI.
 * In a real app, you'd call the CLI via IPC or HTTP endpoint.
 * This is a stub that expects the app to provide a callback.
 */
export function useMemoryStats(
    filePath: string,
    options?: {
        since?: string;
        until?: string;
        top?: number;
        onFetch?: (callback: () => Promise<void>) => void;
    }
) {
    const [data, setData] = useState<MemoryStatsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<MemoryStatsError | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // This is a pattern: your IDE will provide the actual CLI invocation
            // For now, we stub it. In real code:
            // const response = await invokeMemoryStatsCli(filePath, { since, until, top });

            if (!filePath) {
                throw { code: "not_found", message: "No memory file path provided" };
            }

            // Placeholder: would call CLI here
            // For demo, return empty structure
            const stub: MemoryStatsData = {
                schema: { name: "brain.memory.stats", version: "1.0.0" },
                file: filePath,
                filters: { since: options?.since ?? null, until: options?.until ?? null, top: options?.top ?? 20 },
                meta: { scannedLines: 0, parsedArtifacts: 0, includedArtifacts: 0 },
                counts: { totalArtifacts: 0, byDay: [], topOperators: [], topConcepts: [] }
            };

            setData(stub);
        } catch (err: any) {
            setError({
                code: err?.code ?? "unknown",
                message: err?.message ?? String(err)
            });
        } finally {
            setLoading(false);
        }
    }, [filePath, options?.since, options?.until, options?.top]);

    useEffect(() => {
        if (options?.onFetch) {
            options.onFetch(fetch);
        }
    }, [fetch, options?.onFetch]);

    return { data, loading, error, refetch: fetch };
}
