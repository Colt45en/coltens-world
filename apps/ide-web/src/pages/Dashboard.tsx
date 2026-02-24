/**
 * Dashboard.tsx - FlowState Monitoring Dashboard
 *
 * Real-time metrics display:
 * - Total analyses & enrichments
 * - Success rate visualization
 * - Performance metrics
 * - Recent sessions timeline
 */

import React, { useMemo } from "react";
import { useFlowstateMetrics, type AggregateMetrics } from "../bus/useFlowstateMetrics";
import { WorldAppLauncherButtons } from "../components/WorldAppLauncherButtons";

export const Dashboard: React.FC = () => {
  const { metrics, clearMetrics } = useFlowstateMetrics();

  const stats = useMemo(() => {
    return {
      totalAnalyses: metrics.totalAnalyses,
      totalEnrichments: metrics.totalEnrichments,
      successfulEnrichments: metrics.successfulEnrichments,
      failedEnrichments: metrics.failedEnrichments,
      pendingEnrichments: metrics.pendingEnrichments,
      successRate: metrics.enrichmentSuccessRate.toFixed(1),
      avgAnalysisMs: metrics.averageAnalysisTime.toFixed(2),
      avgEnrichmentMs: metrics.averageEnrichmentTime.toFixed(2),
      avgTokens: Math.round(metrics.averageTokens),
    };
  }, [metrics]);

  const successPercentage = Math.round(
    (metrics.successfulEnrichments /
      Math.max(metrics.totalEnrichments, 1)) *
      100
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>FlowState Monitoring Dashboard</h1>
        <button onClick={clearMetrics} style={styles.clearButton}>
          Clear Metrics
        </button>
      </div>

      <WorldAppLauncherButtons
        title="World Engine App Launcher"
        subtitle="New route/iframe apps added to WORLD_APPS automatically appear here."
        excludeIds={["launcher", "neon-hub"]}
        compact={true}
      />

      {/* KPI Grid */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>{stats.totalAnalyses}</div>
          <div style={styles.kpiLabel}>Total Analyses</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>{stats.totalEnrichments}</div>
          <div style={styles.kpiLabel}>Enriched</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>{stats.successRate}%</div>
          <div style={styles.kpiLabel}>Success Rate</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>{stats.avgAnalysisMs}ms</div>
          <div style={styles.kpiLabel}>Avg Analysis</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>{stats.avgEnrichmentMs}ms</div>
          <div style={styles.kpiLabel}>Avg Enrichment</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>{stats.avgTokens}</div>
          <div style={styles.kpiLabel}>Avg Tokens</div>
        </div>
      </div>

      {/* Status Bars */}
      <div style={styles.statusSection}>
        <h2 style={styles.sectionTitle}>Enrichment Status</h2>

        <div style={styles.statusRow}>
          <span style={{ color: "#64ffda", minWidth: 80 }}>Success: </span>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${successPercentage}%`,
                background: "rgba(100, 200, 150, 0.8)",
              }}
            />
          </div>
          <span style={{ color: "#e6f1ff", minWidth: 60 }}>
            {stats.successfulEnrichments}/{stats.totalEnrichments}
          </span>
        </div>

        {stats.failedEnrichments > 0 && (
          <div style={styles.statusRow}>
            <span style={{ color: "#ff6b6b", minWidth: 80 }}>Failed: </span>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${(stats.failedEnrichments / Math.max(stats.totalEnrichments, 1)) * 100}%`,
                  background: "rgba(255, 107, 107, 0.8)",
                }}
              />
            </div>
            <span style={{ color: "#e6f1ff", minWidth: 60 }}>
              {stats.failedEnrichments}
            </span>
          </div>
        )}

        {stats.pendingEnrichments > 0 && (
          <div style={styles.statusRow}>
            <span style={{ color: "#ffd700", minWidth: 80 }}>Pending: </span>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${(stats.pendingEnrichments / Math.max(stats.totalEnrichments + stats.pendingEnrichments, 1)) * 100}%`,
                  background: "rgba(255, 215, 0, 0.8)",
                }}
              />
            </div>
            <span style={{ color: "#e6f1ff", minWidth: 60 }}>
              {stats.pendingEnrichments}
            </span>
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div style={styles.sessionsSection}>
        <h2 style={styles.sectionTitle}>Recent Sessions</h2>

        {metrics.sessions.length === 0 ? (
          <div style={styles.emptyMessage}>No sessions recorded yet</div>
        ) : (
          <div style={styles.sessionsList}>
            {metrics.sessions.slice().reverse().map((session, i) => (
              <div key={i} style={styles.sessionRow}>
                <div style={styles.sessionTimestamp}>
                  {new Date(session.timestamp).toLocaleTimeString()}
                </div>

                <div style={styles.sessionMode}>
                  <span
                    style={{
                      ...styles.modeBadge,
                      background: getModeColor(session.mode),
                    }}
                  >
                    {session.mode.toUpperCase()}
                  </span>
                </div>

                <div style={styles.sessionStats}>
                  <span title={`${session.codeLength} characters`}>
                    {session.tokenCount} tokens
                  </span>
                  <span style={{ color: "rgba(230, 241, 255, 0.6)" }}>/</span>
                  <span title={`Analysis time`}>
                    {session.analysisTime.toFixed(1)}ms
                  </span>
                </div>

                <div style={styles.sessionEnrichment}>
                  <StatusBadge status={session.enrichmentStatus} />
                  {session.enrichmentTime && (
                    <span title="Enrichment time" style={{ marginLeft: 8 }}>
                      {session.enrichmentTime.toFixed(1)}ms
                    </span>
                  )}
                  {session.entryCount !== undefined && (
                    <span title="Lexicon entries" style={{ marginLeft: 8 }}>
                      {session.entryCount} entries
                    </span>
                  )}
                </div>

                {session.error && (
                  <div style={styles.errorMessage} title={session.error}>
                    ⚠ {session.error.slice(0, 30)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Components

function StatusBadge({
  status,
}: {
  status: "pending" | "success" | "failure" | "timeout";
}) {
  const colors = {
    pending: { bg: "rgba(255, 215, 0, 0.2)", color: "#ffd700", label: "⏳ Pending" },
    success: { bg: "rgba(100, 200, 150, 0.2)", color: "#64c896", label: "✓ Success" },
    failure: { bg: "rgba(255, 107, 107, 0.2)", color: "#ff6b6b", label: "✗ Failed" },
    timeout: { bg: "rgba(255, 165, 0, 0.2)", color: "#ffa500", label: "⏱ Timeout" },
  };

  const style = colors[status];
  return (
    <span
      style={{
        ...styles.statusBadge,
        background: style.bg,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
}

function getModeColor(mode: string): string {
  const colors: Record<string, string> = {
    ring: "rgba(100, 255, 218, 0.3)",
    orbit: "rgba(100, 200, 255, 0.3)",
    heatmap: "rgba(255, 100, 150, 0.3)",
    histogram: "rgba(255, 200, 100, 0.3)",
  };
  return colors[mode] || "rgba(100, 255, 218, 0.2)";
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    background: "#0a0e27",
    color: "#e6f1ff",
    fontFamily: "monospace",
    fontSize: 12,
    padding: 16,
    gap: 24,
    overflowY: "auto" as const,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(100, 255, 218, 0.15)",
    paddingBottom: 16,
  },

  clearButton: {
    padding: "6px 12px",
    background: "rgba(255, 107, 107, 0.1)",
    color: "#ff6b6b",
    border: "1px solid rgba(255, 107, 107, 0.3)",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "monospace",
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
  },

  kpiCard: {
    background: "rgba(100, 255, 218, 0.05)",
    border: "1px solid rgba(100, 255, 218, 0.2)",
    borderRadius: 6,
    padding: 12,
    textAlign: "center" as const,
  },

  kpiValue: {
    fontSize: 20,
    fontWeight: "bold" as const,
    color: "#64ffda",
    marginBottom: 4,
  },

  kpiLabel: {
    fontSize: 10,
    color: "rgba(230, 241, 255, 0.6)",
    lineHeight: 1.3,
  },

  statusSection: {
    background: "rgba(20, 30, 60, 0.5)",
    border: "1px solid rgba(100, 255, 218, 0.1)",
    borderRadius: 6,
    padding: 12,
  },

  sectionTitle: {
    fontSize: 12,
    color: "#64ffda",
    marginBottom: 12,
    marginTop: 0,
  },

  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    fontSize: 11,
  },

  progressBar: {
    flex: 1,
    height: 8,
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: 4,
    overflow: "hidden" as const,
  },

  progressFill: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.3s ease",
  },

  sessionsSection: {
    background: "rgba(20, 30, 60, 0.5)",
    border: "1px solid rgba(100, 255, 218, 0.1)",
    borderRadius: 6,
    padding: 12,
    flex: 1,
    minHeight: 0,
    overflow: "hidden" as const,
  },

  sessionsList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    overflowY: "auto" as const,
    maxHeight: "100%",
  },

  sessionRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    background: "rgba(0, 0, 0, 0.2)",
    borderRadius: 4,
    border: "1px solid rgba(100, 255, 218, 0.1)",
    fontSize: 10,
    whiteSpace: "nowrap" as const,
  },

  sessionTimestamp: {
    color: "rgba(230, 241, 255, 0.5)",
    minWidth: 70,
  },

  sessionMode: {
    flex: 0,
  },

  modeBadge: {
    padding: "2px 6px",
    borderRadius: 3,
    fontSize: 9,
    fontWeight: "bold" as const,
    color: "#000",
  },

  sessionStats: {
    display: "flex",
    gap: 4,
    color: "rgba(230, 241, 255, 0.7)",
    flex: 0,
  },

  sessionEnrichment: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },

  statusBadge: {
    padding: "2px 6px",
    borderRadius: 3,
    fontSize: 9,
    fontWeight: "bold" as const,
  },

  errorMessage: {
    color: "#ff6b6b",
    fontSize: 9,
    maxWidth: 100,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
  },

  emptyMessage: {
    textAlign: "center" as const,
    color: "rgba(230, 241, 255, 0.4)",
    padding: 32,
    fontSize: 11,
  },
};
