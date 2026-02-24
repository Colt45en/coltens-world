import { useCallback, useState } from "react";

export type QueryResultItem = {
    id: string;
    createdAt: string;
    selectedReasoningMode: string;
    operatorsUsed: string[];
    userGoal: string;
    responseSummary: string;
};

export type MemoryQueryData = {
    schema: { name: string; version: string };
    file: string;
    filters: {
        contains: string | null;
        operator: string | null;
        concept: string | null;
        since: string | null;
        until: string | null;
        limit: number;
    };
    meta: { scannedLines: number; parsedArtifacts: number; returned: number };
    results: QueryResultItem[];
};

export type MemoryQueryError = {
    code: "not_found" | "parse_error" | "cli_error" | "unknown";
    message: string;
};

/**
 * Hook to fetch memory query results from CLI.
 * Stub pattern: IDE app provides actual CLI invocation callback.
 */
export function useMemoryQuery(
    filePath: string,
    filters?: {
        contains?: string;
        operator?: string;
        concept?: string;
        since?: string;
        until?: string;
        limit?: number;
    }
) {
    const [data, setData] = useState<MemoryQueryData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<MemoryQueryError | null>(null);

    const execute = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            if (!filePath) {
                throw { code: "not_found", message: "No memory file path provided" };
            }

            // Stub: real code calls CLI via IPC/HTTP
            const stub: MemoryQueryData = {
                schema: { name: "brain.memory.query_result", version: "1.0.0" },
                file: filePath,
                filters: {
                    contains: filters?.contains ?? null,
                    operator: filters?.operator ?? null,
                    concept: filters?.concept ?? null,
                    since: filters?.since ?? null,
                    until: filters?.until ?? null,
                    limit: filters?.limit ?? 50
                },
                meta: { scannedLines: 0, parsedArtifacts: 0, returned: 0 },
                results: []
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
    }, [filePath, filters?.contains, filters?.operator, filters?.concept, filters?.since, filters?.until, filters?.limit]);

    return { data, loading, error, execute };
}
