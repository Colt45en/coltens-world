import { useNavigate } from "react-router-dom";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import { Activity, Database, MessageSquare, Network, Wifi, WifiOff, Zap } from "lucide-react";
import React, { useEffect, useState, useMemo } from "react";
import { AdvancedMetricsCard } from "../ui/AdvancedMetricsCard";
import { DataTable, type Column } from "../ui/DataTable";
import { TabPanel, type Tab } from "../ui/TabPanel";
import { LoadingSpinner } from "../ui/LoadingSpinner";

interface NucleusEvent {
  id: string;
  type: string;
  timestamp: number;
  payload: any;
  source?: string;
}

interface WebSocketStats {
  connected: boolean;
  messageCount: number;
  errorCount: number;
  averageLatency: number;
  reconnectAttempts: number;
  uptime: number;
}

export function LabNucleusPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<NucleusEvent[]>([]);
  const [stats, setStats] = useState<WebSocketStats>({
    connected: false,
    messageCount: 0,
    errorCount: 0,
    averageLatency: 0,
    reconnectAttempts: 0,
    uptime: 0,
  });
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [filter, setFilter] = useState<string>("all");

  // WebSocket connection monitoring
  useEffect(() => {
    const ws = (window as any).__NUCLEUS_WS__;
    if (!ws) {
      setConnectionStatus("disconnected");
      return;
    }

    const startTime = Date.now();
    setConnectionStatus("connected");

    const handleMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        const event: NucleusEvent = {
          id: `${Date.now()}-${Math.random()}`,
          type: data.type || "unknown",
          timestamp: Date.now(),
          payload: data,
          source: data.source || "nucleus",
        };

        setEvents(prev => [event, ...prev].slice(0, 100));
        setStats(prev => ({
          ...prev,
          messageCount: prev.messageCount + 1,
          uptime: Date.now() - startTime,
        }));
      } catch (err) {
        setStats(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
      }
    };

    const handleError = () => {
      setConnectionStatus("disconnected");
      setStats(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    };

    const handleOpen = () => {
      setConnectionStatus("connected");
    };

    const handleClose = () => {
      setConnectionStatus("disconnected");
    };

    ws.addEventListener("message", handleMessage);
    ws.addEventListener("error", handleError);
    ws.addEventListener("open", handleOpen);
    ws.addEventListener("close", handleClose);

    return () => {
      ws.removeEventListener("message", handleMessage);
      ws.removeEventListener("error", handleError);
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("close", handleClose);
    };
  }, []);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter(e => e.type.includes(filter));
  }, [events, filter]);

  const eventsByType = useMemo(() => {
    const types: Record<string, number> = {};
    events.forEach(e => {
      types[e.type] = (types[e.type] || 0) + 1;
    });
    return Object.entries(types)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const columns: Column<NucleusEvent>[] = [
    {
      key: "timestamp",
      label: "Time",
      width: 100,
      render: (val) => new Date(val).toLocaleTimeString(),
    },
    {
      key: "type",
      label: "Event Type",
      width: 200,
      render: (val) => (
        <span style={{ color: getEventColor(val), fontWeight: "bold" }}>
          {val}
        </span>
      ),
    },
    {
      key: "source",
      label: "Source",
      width: 100,
    },
    {
      key: "payload",
      label: "Payload",
      render: (val) => (
        <code style={{ fontSize: 11, color: "rgba(230, 241, 255, 0.7)" }}>
          {JSON.stringify(val).slice(0, 80)}...
        </code>
      ),
    },
  ];

  const tabs: Tab[] = [
    {
      id: "events",
      label: "Event Stream",
      icon: <Activity size={14} />,
      badge: events.length,
      content: (
        <div>
          <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["all", "system", "flowstate", "brain", "chat", "tool"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 12px",
                  background: filter === f ? "rgba(100, 255, 218, 0.2)" : "rgba(100, 255, 218, 0.05)",
                  border: `1px solid ${filter === f ? "#64ffda" : "rgba(100, 255, 218, 0.2)"}`,
                  borderRadius: 6,
                  color: filter === f ? "#64ffda" : "rgba(230, 241, 255, 0.7)",
                  fontSize: 11,
                  fontWeight: filter === f ? "bold" : "normal",
                  fontFamily: "monospace",
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <DataTable
            data={filteredEvents}
            columns={columns}
            pageSize={20}
            searchable={true}
            searchKeys={["type", "source"]}
            emptyMessage="No events captured yet. Connect to Nucleus to see events."
            onRowClick={(event) => console.log("Event details:", event)}
          />
        </div>
      ),
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: <Database size={14} />,
      content: (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: "bold", color: "#64ffda", marginBottom: 12 }}>
            Event Distribution
          </h3>
          <DataTable
            data={eventsByType}
            columns={[
              { key: "type", label: "Event Type" },
              { key: "count", label: "Count", width: 100 },
            ]}
            pageSize={15}
            searchable={false}
          />
        </div>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: <MessageSquare size={14} />,
      content: (
        <div style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: "bold", color: "#64ffda", marginBottom: 12 }}>
            Nucleus Configuration
          </h3>
          <div style={{ fontSize: 12, color: "rgba(230, 241, 255, 0.7)", lineHeight: 1.6 }}>
            <p><strong>WebSocket URL:</strong> ws://localhost:3000</p>
            <p><strong>Reconnect Strategy:</strong> Exponential backoff</p>
            <p><strong>Max Events Buffer:</strong> 100</p>
            <p><strong>Event Filters:</strong> Configurable</p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <NeonTitle as="h2" className="text-2xl flex items-center gap-2">
              <Network className="text-cyan-400" size={28} />
              Nucleus Monitor
            </NeonTitle>
            <p className="text-white/60 mt-3">
              Real-time event monitor and WebSocket orchestration hub. Track all system events,
              analyze traffic patterns, and monitor connection health.
            </p>
          </div>
          <NeonButton variant="ghost" onClick={() => navigate("/")}>
            Back
          </NeonButton>
        </div>

        {/* Connection Status Bar */}
        <div className="mt-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {connectionStatus === "connected" ? (
              <Wifi className="text-green-400" size={20} />
            ) : (
              <WifiOff className="text-red-400" size={20} />
            )}
            <span className={`text-sm font-bold ${
              connectionStatus === "connected" ? "text-green-300" : "text-red-300"
            }`}>
              {connectionStatus.toUpperCase()}
            </span>
          </div>

          {connectionStatus === "connected" && (
            <div className="flex-1 flex items-center gap-6 text-xs text-white/50">
              <span>ws://localhost:3000</span>
              <span>⏱ Uptime: {Math.floor(stats.uptime / 1000)}s</span>
              <span>📨 Messages: {stats.messageCount}</span>
              {stats.errorCount > 0 && <span className="text-red-400">❌ Errors: {stats.errorCount}</span>}
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AdvancedMetricsCard
          label="Total Events"
          value={stats.messageCount}
          icon={<Zap size={20} />}
          color="#64ffda"
          trend={stats.messageCount > 0 ? "up" : "stable"}
        />
        <AdvancedMetricsCard
          label="Event Types"
          value={eventsByType.length}
          icon={<Activity size={20} />}
          color="#6495ed"
        />
        <AdvancedMetricsCard
          label="Errors"
          value={stats.errorCount}
          icon={<MessageSquare size={20} />}
          color="#ff6b6b"
          alert={stats.errorCount > 0 ? "error" : "success"}
        />
        <AdvancedMetricsCard
          label="Connection"
          value={connectionStatus === "connected" ? "ONLINE" : "OFFLINE"}
          icon={<Network size={20} />}
          color={connectionStatus === "connected" ? "#64c896" : "#ff6b6b"}
          alert={connectionStatus === "connected" ? "success" : "warning"}
        />
      </div>

      {/* Main Content - Tabs */}
      <GlassPanel className="rounded-2xl" style={{ minHeight: 600 }}>
        {connectionStatus === "disconnected" ? (
          <div style={{ padding: 64, textAlign: "center" }}>
            <WifiOff size={48} style={{ margin: "0 auto 16px", color: "rgba(230, 241, 255, 0.3)" }} />
            <h3 style={{ fontSize: 16, color: "rgba(230, 241, 255, 0.7)", marginBottom: 8 }}>
              Not Connected to Nucleus
            </h3>
            <p style={{ fontSize: 12, color: "rgba(230, 241, 255, 0.5)" }}>
              Start the Nucleus WebSocket server to begin monitoring events.
            </p>
          </div>
        ) : (
          <TabPanel tabs={tabs} defaultTab="events" />
        )}
      </GlassPanel>
    </div>
  );
}

function getEventColor(eventType: string): string {
  if (eventType.includes("error") || eventType.includes("fail")) return "#ff6b6b";
  if (eventType.includes("success")) return "#64c896";
  if (eventType.includes("brain") || eventType.includes("cognition")) return "#9b59b6";
  if (eventType.includes("flowstate")) return "#64ffda";
  if (eventType.includes("tool")) return "#ffa500";
  return "#6495ed";
}
