/**
 * ChatStreamDemo - P0 Stream Consumer Demonstration
 *
 * Shows real-time P0 ordering validation:
 * - Status: connecting → open → closed/error
 * - Events: live NDJSON rendering
 * - Metrics: seq violations (dupes, gaps, rewinds)
 *
 * Usage:
 * ```tsx
 * <ChatStreamDemo url="/api/chat/stream" />
 * ```
 */

import { useState } from "react";
import { useNdjsonConsumer } from "../hooks/useNdjsonConsumer";

export interface ChatStreamDemoProps {
  url: string;
  title?: string;
  onSubmit?: (message: string) => Promise<void>;
}

export function ChatStreamDemo({
  url,
  title = "P0 Stream Consumer",
  onSubmit,
}: ChatStreamDemoProps) {
  const { status, events, lastSeq, ordering, error, reset } = useNdjsonConsumer({
    url,
  });

  const [input, setInput] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    setIsRequesting(true);
    try {
      if (onSubmit) {
        await onSubmit(input);
      }
      setInput("");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
        border: "1px solid #333",
        borderRadius: "8px",
        fontFamily: "monospace",
        fontSize: "12px",
        backgroundColor: "#fafafa",
      }}
    >
      <h3 style={{ margin: "0 0 12px 0" }}>{title}</h3>

      {/* Status bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "8px",
          backgroundColor: "#f0f0f0",
          borderRadius: "4px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <strong>Status:</strong>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "3px",
              backgroundColor:
                status === "open"
                  ? "#d4edda"
                  : status === "error"
                    ? "#f8d7da"
                    : "#e2e3e5",
              color:
                status === "open" ? "#155724" : status === "error" ? "#721c24" : "#383d41",
            }}
          >
            {status}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <strong>lastSeq:</strong>
          <span>{lastSeq !== null ? lastSeq : "—"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <strong>P0:</strong>
          <span
            style={{
              color: ordering.ok ? "#28a745" : "#dc3545",
              fontWeight: "bold",
            }}
          >
            {ordering.ok ? "✅ ok" : "❌ violated"}
          </span>
        </div>

        {(ordering.dupes > 0 || ordering.gaps > 0 || ordering.rewinds > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: "auto",
              color: "#dc3545",
            }}
          >
            <span>Violations:</span>
            {ordering.dupes > 0 && <span>dupes={ordering.dupes}</span>}
            {ordering.gaps > 0 && <span>gaps={ordering.gaps}</span>}
            {ordering.rewinds > 0 && <span>rewinds={ordering.rewinds}</span>}
          </div>
        )}

        {error && (
          <div style={{ marginLeft: "auto", color: "#dc3545" }}>
            ⚠️ {error.message}
          </div>
        )}

        <button
          onClick={reset}
          style={{
            marginLeft: "auto",
            padding: "4px 8px",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      {/* Events list */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "4px",
          height: "400px",
          overflow: "auto",
          backgroundColor: "#fff",
        }}
      >
        {events.length === 0 ? (
          <div
            style={{
              padding: "16px",
              color: "#999",
              textAlign: "center",
            }}
          >
            {status === "connecting" ? "Connecting..." : "No events yet"}
          </div>
        ) : (
          events.map((event, idx) => (
            <div
              key={`${event.turnId}-${event.seq}`}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #eee",
                backgroundColor: idx % 2 === 0 ? "#fff" : "#f9f9f9",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ color: "#0066cc", fontWeight: "bold" }}>
                  [{event.seq}]
                </span>
                <span style={{ color: "#666" }}>
                  {event.turnId}
                </span>
                <span style={{ color: "#888", marginLeft: "auto" }}>
                  {event.type}
                </span>
              </div>
              {Object.entries(event).map(([k, v]) => {
                if (["type", "turnId", "seq", "ts_utc"].includes(k)) return null;
                return (
                  <div key={k} style={{ color: "#555", marginTop: "4px" }}>
                    <strong>{k}:</strong>{" "}
                    {typeof v === "string" && v.length > 80
                      ? v.slice(0, 80) + "…"
                      : JSON.stringify(v)}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Input (optional) */}
      {onSubmit && (
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            disabled={isRequesting || status !== "open"}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "12px",
            }}
          />
          <button
            onClick={handleSend}
            disabled={isRequesting || !input.trim() || status !== "open"}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              cursor: "pointer",
              backgroundColor: isRequesting ? "#eee" : "#fff",
            }}
          >
            {isRequesting ? "Sending…" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
