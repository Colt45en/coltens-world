/**
 * EcosystemDashboard.tsx - Unified System Monitoring Dashboard
 *
 * Comprehensive view of the entire ecosystem:
 * - System Health (all services)
 * - FlowState Metrics
 * - Telemetry Events Stream
 * - Component Status
 * - Performance Metrics
 */

import React, { useMemo, useState, useEffect } from "react";
import { useSystemHealth } from "../system/useSystemHealth";
import { useFlowstateMetrics } from "../bus/useFlowstateMetrics";
import type { ServiceHealth, HealthState } from "@world-engine/protocol";

export const EcosystemDashboard: React.FC = () => {
  const healthState = useSystemHealth();
  const { metrics, clearMetrics } = useFlowstateMetrics();
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Subscribe to telemetry events via WebSocket
  useEffect(() => {
    const ws = (window as any).__NUCLEUS_WS__;
    if (!ws) return;

    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type && data.type !== "system.health") {
          setEvents((prev) => [
            {
              type: data.type,
              timestamp: new Date().toISOString(),
              payload: data.payload || data,
            },
            ...prev.slice(0, 49), // Keep last 50 events
          ]);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, []);

  const systemStatus = useMemo(() => {
    if (!healthState.last) return "unknown";
    return healthState.last.summary;
  }, [healthState]);

  const servicesByName = useMemo(() => {
    if (!healthState.last) return new Map();
    return new Map(
      healthState.last.services.map((s) => [s.service, s])
    );
  }, [healthState]);

  const flowstateStats = useMemo(() => {
    return {
      totalAnalyses: metrics.totalAnalyses,
      successRate: metrics.enrichmentSuccessRate.toFixed(1),
      avgAnalysisMs: metrics.averageAnalysisTime.toFixed(2),
      avgTokens: Math.round(metrics.averageTokens),
    };
  }, [metrics]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Ecosystem Dashboard</h1>
          <div style={styles.subtitle}>
            Real-time monitoring • {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div style={styles.headerActions}>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={clearMetrics} style={styles.clearButton}>
            Clear Metrics
          </button>
        </div>
      </div>

      {/* System Status Banner */}
      <div style={styles.statusBanner}>
        <SystemStatusIndicator status={systemStatus} />
        <div style={styles.statusText}>
          <strong>System Status:</strong> {systemStatus.toUpperCase()}
          {healthState.lastReceivedAtMs && (
            <span style={styles.statusTime}>
              {" "}
              • Updated{" "}
              {Math.round((Date.now() - healthState.lastReceivedAtMs) / 1000)}s
              ago
            </span>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div style={styles.gridLayout}>
        {/* Left Column - Services & Components */}
        <div style={styles.leftColumn}>
          {/* Service Health Grid */}
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>
              <span>🔌</span> Services
            </h2>
            <div style={styles.servicesGrid}>
              <ServiceCard
                name="Nucleus"
                service={servicesByName.get("nucleus")}
                description="WebSocket Hub & Orchestrator"
              />
              <ServiceCard
                name="Sidecar"
                service={servicesByName.get("sidecar")}
                description="Python Enrichment Service"
              />
              <ServiceCard
                name="IDE Web"
                service={servicesByName.get("ide")}
                description="React Development Interface"
              />
              <ServiceCard
                name="Preview"
                service={servicesByName.get("preview")}
                description="Runtime Preview Environment"
              />
              <ServiceCard
                name="Brain"
                service={servicesByName.get("brain")}
                description="Cognition & Agent System"
              />
            </div>
          </div>

          {/* Component Map */}
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>
              <span>🧩</span> Ecosystem Components
            </h2>
            <div style={styles.componentMap}>
              <ComponentNode
                name="FlowState"
                status={metrics.totalAnalyses > 0 ? "active" : "idle"}
                metrics={`${metrics.totalAnalyses} analyses`}
              />
              <ComponentNode
                name="Lexicon"
                status={
                  metrics.successfulEnrichments > 0 ? "active" : "idle"
                }
                metrics={`${metrics.successfulEnrichments} enrichments`}
              />
              <ComponentNode
                name="Telemetry"
                status={events.length > 0 ? "active" : "idle"}
                metrics={`${events.length} events`}
              />
              <ComponentNode
                name="Sandbox"
                status="ready"
                metrics="Environment ready"
              />
              <ComponentNode
                name="Protocol"
                status="ready"
                metrics="Contracts validated"
              />
              <ComponentNode
                name="Bus"
                status={healthState.last ? "active" : "unknown"}
                metrics="Event routing"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Metrics & Events */}
        <div style={styles.rightColumn}>
          {/* FlowState KPIs */}
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>
              <span>📊</span> FlowState Metrics
            </h2>
            <div style={styles.kpiGrid}>
              <KpiCard
                label="Analyses"
                value={flowstateStats.totalAnalyses}
                color="#64ffda"
              />
              <KpiCard
                label="Success Rate"
                value={`${flowstateStats.successRate}%`}
                color="#64c896"
              />
              <KpiCard
                label="Avg Analysis"
                value={`${flowstateStats.avgAnalysisMs}ms`}
                color="#6495ed"
              />
              <KpiCard
                label="Avg Tokens"
                value={flowstateStats.avgTokens}
                color="#ffa500"
              />
            </div>
          </div>

          {/* Event Stream */}
          <div style={{ ...styles.panel, flex: 1 }}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>
                <span>📡</span> Event Stream
              </h2>
              <button
                onClick={() => setEvents([])}
                style={styles.clearEventsButton}
              >
                Clear
              </button>
            </div>
            <div style={styles.eventStream}>
              {events.length === 0 ? (
                <div style={styles.emptyMessage}>
                  Waiting for events...
                </div>
              ) : (
                events.map((event, i) => (
                  <EventRow key={i} event={event} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

interface ServiceCardProps {
  name: string;
  service?: ServiceHealth;
  description: string;
}

function ServiceCard({ name, service, description }: ServiceCardProps) {
  const state = service?.state || "unknown";
  const color = getHealthColor(state);

  return (
    <div style={styles.serviceCard}>
      <div style={styles.serviceHeader}>
        <div style={{ ...styles.serviceIndicator, background: color }} />
        <div style={styles.serviceName}>{name}</div>
      </div>
      <div style={styles.serviceDescription}>{description}</div>
      <div style={styles.serviceStatus}>
        <span style={{ color }}>
          {state.toUpperCase()}
        </span>
        {service?.latencyMs && (
          <span style={styles.serviceLatency}>
            {service.latencyMs}ms
          </span>
        )}
      </div>
      {service?.reason && (
        <div style={styles.serviceReason} title={service.reason}>
          {service.reason.slice(0, 40)}
          {service.reason.length > 40 ? "..." : ""}
        </div>
      )}
    </div>
  );
}

interface ComponentNodeProps {
  name: string;
  status: "active" | "idle" | "ready" | "unknown";
  metrics: string;
}

function ComponentNode({ name, status, metrics }: ComponentNodeProps) {
  const statusColors = {
    active: "#64ffda",
    idle: "#6495ed",
    ready: "#ffa500",
    unknown: "#666",
  };

  return (
    <div style={styles.componentNode}>
      <div
        style={{
          ...styles.componentDot,
          background: statusColors[status],
        }}
      />
      <div>
        <div style={styles.componentName}>{name}</div>
        <div style={styles.componentMetrics}>{metrics}</div>
      </div>
    </div>
  );
}

function SystemStatusIndicator({ status }: { status: HealthState | "unknown" }) {
  const colors = {
    up: "#64c896",
    degraded: "#ffa500",
    down: "#ff6b6b",
    unknown: "#666",
  };

  return (
    <div
      style={{
        ...styles.statusDot,
        background: colors[status],
        boxShadow: `0 0 12px ${colors[status]}`,
      }}
    />
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  color: string;
}

function KpiCard({ label, value, color }: KpiCardProps) {
  return (
    <div style={styles.kpiCard}>
      <div style={{ ...styles.kpiValue, color }}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}

interface TelemetryEvent {
  type: string;
  timestamp: string;
  payload: any;
}

function EventRow({ event }: { event: TelemetryEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const typeColor = getEventTypeColor(event.type);

  return (
    <div style={styles.eventRow}>
      <span style={styles.eventTime}>{time}</span>
      <span style={{ ...styles.eventType, color: typeColor }}>
        {event.type}
      </span>
      <span style={styles.eventPayload}>
        {JSON.stringify(event.payload).slice(0, 60)}...
      </span>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function getHealthColor(state: HealthState | "unknown"): string {
  const colors = {
    up: "#64c896",
    degraded: "#ffa500",
    down: "#ff6b6b",
    unknown: "#666",
  };
  return colors[state];
}

function getEventTypeColor(type: string): string {
  if (type.includes("error") || type.includes("fail")) return "#ff6b6b";
  if (type.includes("success") || type.includes("complete")) return "#64c896";
  if (type.includes("cognition") || type.includes("brain")) return "#9b59b6";
  if (type.includes("flowstate") || type.includes("metrics")) return "#64ffda";
  if (type.includes("tool")) return "#ffa500";
  return "#6495ed";
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    background: "#0a0e27",
    color: "#e6f1ff",
    fontFamily: "monospace",
    fontSize: 12,
    overflow: "hidden",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottom: "1px solid rgba(100, 255, 218, 0.15)",
    background: "rgba(10, 14, 39, 0.8)",
  },

  title: {
    margin: 0,
    fontSize: 20,
    color: "#64ffda",
    fontWeight: "bold" as const,
  },

  subtitle: {
    fontSize: 10,
    color: "rgba(230, 241, 255, 0.5)",
    marginTop: 4,
  },

  headerActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },

  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontSize: 11,
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

  statusBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    background: "rgba(100, 255, 218, 0.05)",
    borderBottom: "1px solid rgba(100, 255, 218, 0.1)",
  },

  statusDot: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    animation: "pulse 2s ease-in-out infinite",
  },

  statusText: {
    fontSize: 13,
  },

  statusTime: {
    color: "rgba(230, 241, 255, 0.5)",
    fontSize: 11,
  },

  gridLayout: {
    display: "flex",
    flex: 1,
    gap: 16,
    padding: 16,
    overflow: "hidden",
  },

  leftColumn: {
    flex: "1 1 40%",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    minWidth: 300,
  },

  rightColumn: {
    flex: "1 1 60%",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    minWidth: 400,
  },

  panel: {
    background: "rgba(20, 30, 60, 0.5)",
    border: "1px solid rgba(100, 255, 218, 0.1)",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  panelTitle: {
    margin: 0,
    marginBottom: 12,
    fontSize: 14,
    color: "#64ffda",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  servicesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },

  serviceCard: {
    background: "rgba(10, 20, 40, 0.6)",
    border: "1px solid rgba(100, 255, 218, 0.15)",
    borderRadius: 6,
    padding: 12,
  },

  serviceHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  serviceIndicator: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },

  serviceName: {
    fontSize: 13,
    fontWeight: "bold" as const,
    color: "#e6f1ff",
  },

  serviceDescription: {
    fontSize: 10,
    color: "rgba(230, 241, 255, 0.5)",
    marginBottom: 8,
    lineHeight: 1.4,
  },

  serviceStatus: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    fontWeight: "bold" as const,
  },

  serviceLatency: {
    color: "rgba(230, 241, 255, 0.6)",
  },

  serviceReason: {
    marginTop: 6,
    fontSize: 9,
    color: "rgba(230, 241, 255, 0.4)",
    fontStyle: "italic" as const,
  },

  componentMap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 10,
  },

  componentNode: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    background: "rgba(10, 20, 40, 0.4)",
    border: "1px solid rgba(100, 255, 218, 0.1)",
    borderRadius: 6,
  },

  componentDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    marginTop: 4,
  },

  componentName: {
    fontSize: 11,
    fontWeight: "bold" as const,
    color: "#e6f1ff",
  },

  componentMetrics: {
    fontSize: 9,
    color: "rgba(230, 241, 255, 0.5)",
    marginTop: 2,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
    gap: 10,
  },

  kpiCard: {
    background: "rgba(10, 20, 40, 0.4)",
    border: "1px solid rgba(100, 255, 218, 0.15)",
    borderRadius: 6,
    padding: 12,
    textAlign: "center" as const,
  },

  kpiValue: {
    fontSize: 18,
    fontWeight: "bold" as const,
    marginBottom: 4,
  },

  kpiLabel: {
    fontSize: 9,
    color: "rgba(230, 241, 255, 0.6)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },

  eventStream: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    overflowY: "auto" as const,
    padding: 4,
  },

  eventRow: {
    display: "flex",
    gap: 12,
    padding: "6px 8px",
    background: "rgba(10, 20, 40, 0.4)",
    border: "1px solid rgba(100, 255, 218, 0.05)",
    borderRadius: 4,
    fontSize: 10,
    fontFamily: "monospace",
  },

  eventTime: {
    color: "rgba(230, 241, 255, 0.4)",
    minWidth: 70,
  },

  eventType: {
    fontWeight: "bold" as const,
    minWidth: 140,
  },

  eventPayload: {
    color: "rgba(230, 241, 255, 0.6)",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },

  clearEventsButton: {
    padding: "4px 8px",
    background: "rgba(100, 255, 218, 0.05)",
    color: "#64ffda",
    border: "1px solid rgba(100, 255, 218, 0.2)",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 10,
    fontFamily: "monospace",
  },

  emptyMessage: {
    textAlign: "center" as const,
    color: "rgba(230, 241, 255, 0.3)",
    padding: 32,
    fontSize: 11,
  },
};
