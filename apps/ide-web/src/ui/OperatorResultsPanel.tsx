/**
 * Operator Results Panel
 *
 * IDE component for displaying operator execution results.
 * Subscribes to operator.executed events from WS bus.
 *
 * Features:
 * - Live execution status
 * - Result display (diffs, deltas, errors)
 * - Memory writes visualization
 * - Deterministic hash verification
 * - Execution timing
 */

import React, { useEffect, useState } from "react";
import "./OperatorResultsPanel.css";

interface OperatorResult {
  operator_id: string;
  operator_name: string;
  trace_id: string;
  status: "success" | "validation_error" | "timeout" | "execution_error";
  result: Record<string, any>;
  error?: Record<string, any>;
  memory_writes?: Array<{ key: string; value: string; ttl_seconds?: number }>;
  execution_time_ms: number;
  deterministic_hash?: string;
  timestamp: number;
}

interface Props {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const OperatorResultsPanel: React.FC<Props> = ({
  autoRefresh = true,
  refreshInterval = 2000,
}) => {
  const [results, setResults] = useState<OperatorResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanding, setExpanding] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch operator events from API
  useEffect(() => {
    if (!autoRefresh) return;

    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const resp = await fetch("http://localhost:3000/operator/events");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        setResults(
          (data.events || []).map((ev: any) => ({
            operator_id: ev.operator_id,
            operator_name: ev.operator_name,
            trace_id: ev.trace_id,
            status: ev.status,
            result: ev.result || {},
            error: ev.error,
            memory_writes: ev.memory_writes || [],
            execution_time_ms: ev.execution_time_ms || 0,
            deterministic_hash: ev.deterministic_hash,
            timestamp: new Date(ev.created_at).getTime() || Date.now(),
          })),
        );
      } catch (err) {
        console.error("[OperatorResultsPanel] Failed to fetch:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const selectedResult = results.find((r) => r.operator_id === selectedId);

  const toggleExpand = (id: string) => {
    setExpanding((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "success":
        return "#10b981"; // emerald
      case "validation_error":
        return "#f59e0b"; // amber
      case "timeout":
        return "#f59e0b"; // amber
      case "execution_error":
        return "#e11d48"; // rose
      default:
        return "#8b5cf6";
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "success":
        return "✅";
      case "validation_error":
        return "⚠️";
      case "timeout":
        return "⏱️";
      case "execution_error":
        return "❌";
      default:
        return "❓";
    }
  };

  return (
    <div className="operator-results-container">
      {/* Header */}
      <div className="operator-results-header">
        🧠 Operator Results ({results.length})
      </div>

      {/* List pane */}
      <div className="operator-results-list" style={{ borderRight: selectedId ? "1px solid #223049" : "none" }}>
        {results.length === 0 ? (
          <div className="operator-results-empty">
            No operator executions yet...
          </div>
        ) : (
          results.map((result) => (
            <div
              key={result.operator_id}
              onClick={() => setSelectedId(result.operator_id)}
              className={`operator-results-item ${selectedId === result.operator_id ? "active" : ""}`}
              onMouseEnter={(e) => {
                if (selectedId !== result.operator_id) {
                  (e.currentTarget as HTMLDivElement).classList.add("hover");
                }
              }}
              onMouseLeave={(e) => {
                if (selectedId !== result.operator_id) {
                  (e.currentTarget as HTMLDivElement).classList.remove("hover");
                }
              }}
            >
              <div className="operator-results-status">
                {statusIcon(result.status)} {result.status}
              </div>
              <div className="operator-results-name">
                {result.operator_name}
              </div>
              <div className="operator-results-meta">
                {result.execution_time_ms}ms • {new Date(result.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail pane */}
      {selectedResult && (
        <div className="operator-results-detail">
          {/* Header */}
          <div className="operator-results-detail-header">
            <div className="operator-results-detail-title">
              {statusIcon(selectedResult.status)} {selectedResult.operator_name}
            </div>
            <div className="operator-results-detail-id">
              ID: {selectedResult.operator_id.slice(0, 16)}...
            </div>
            <div className="operator-results-detail-time">
              Time: {selectedResult.execution_time_ms}ms
            </div>
          </div>

          {/* Error */}
          {selectedResult.error && (
            <div className="operator-results-error">
              <div className="operator-results-error-code">
                ❌ {selectedResult.error.code}
              </div>
              <div className="operator-results-error-message">
                {selectedResult.error.message}
              </div>
            </div>
          )}

          {/* Result */}
          {selectedResult.result && Object.keys(selectedResult.result).length > 0 && (
            <div className="operator-results-section">
              <div
                className="operator-results-section-title"
                onClick={() => toggleExpand("result")}
              >
                {expanding.has("result") ? "▼" : "▶"} Result
              </div>
              {expanding.has("result") && (
                <pre className="operator-results-json">
                  {JSON.stringify(selectedResult.result, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Memory Writes */}
          {selectedResult.memory_writes && selectedResult.memory_writes.length > 0 && (
            <div className="operator-results-section">
              <div
                className="operator-results-section-title"
                onClick={() => toggleExpand("memory")}
              >
                {expanding.has("memory") ? "▼" : "▶"} Memory Writes (
                {selectedResult.memory_writes.length})
              </div>
              {expanding.has("memory") && (
                <div className="operator-results-memory-writes">
                  {selectedResult.memory_writes.map((w, i) => (
                    <div key={i} className="operator-results-memory-write">
                      <div className="operator-results-memory-key">{w.key}</div>
                      {w.ttl_seconds && (
                        <div className="operator-results-memory-ttl">
                          TTL: {w.ttl_seconds}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hash */}
          {selectedResult.deterministic_hash && (
            <div className="operator-results-hash">
              <div className="operator-results-hash-label">
                🔐 Deterministic Hash
              </div>
              <div className="operator-results-hash-value">
                {selectedResult.deterministic_hash.slice(0, 32)}...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
