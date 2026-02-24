import React, { useEffect } from "react";
import { useMemoryStats, type MemoryStatsData } from "./hooks/useMemoryStats";

export interface MemoryPanelProps {
  filePath?: string;
  since?: string;
  until?: string;
  top?: number;
  autoLoad?: boolean;
  onFetch?: (callback: () => Promise<void>) => void;
  onStatsLoaded?: (stats: MemoryStatsData) => void;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  filePath = ".brain/memory/knowledge.ndjson",
  since,
  until,
  top = 20,
  autoLoad = true,
  onFetch,
  onStatsLoaded,
}) => {
  const statsOptions: Parameters<typeof useMemoryStats>[1] = {
    top,
    ...(since ? { since } : {}),
    ...(until ? { until } : {}),
    ...(onFetch ? { onFetch } : {}),
  };

  const { data, loading, error, refetch } = useMemoryStats(filePath, statsOptions);

  useEffect(() => {
    if (autoLoad) {
      void refetch();
    }
  }, [autoLoad, refetch]);

  useEffect(() => {
    if (data && onStatsLoaded) onStatsLoaded(data);
  }, [data, onStatsLoaded]);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(0,0,0,0.25)",
        color: "rgba(255,255,255,0.9)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 12, letterSpacing: 1 }}>MEMORY PANEL</strong>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={loading}
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.05)",
            color: "inherit",
            borderRadius: 8,
            padding: "4px 8px",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.8 }}>
        <div>File: {filePath}</div>
        <div>Window: {since ?? "any"} → {until ?? "now"}</div>
      </div>

      {error ? (
        <div style={{ marginTop: 10, color: "#ff9ca8", fontSize: 12 }}>
          Error: {error.message}
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 12 }}>
        <div>Total Artifacts: {data?.counts.totalArtifacts ?? 0}</div>
        <div>Parsed: {data?.meta.parsedArtifacts ?? 0}</div>
        <div>Included: {data?.meta.includedArtifacts ?? 0}</div>
      </div>
    </div>
  );
};

export default MemoryPanel;
