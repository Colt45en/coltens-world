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
import styles from "./ChatStreamDemo.module.css";

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
    <div className={styles.container}>
      <h3 className={styles.title}>{title}</h3>

      {/* Status bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusItem}>
          <strong>Status:</strong>
          <span className={`${styles.statusBadge} ${styles[`status-${status}`]}`}>{status}</span>
        </div>

        <div className={styles.statusItem}>
          <strong>lastSeq:</strong>
          <span>{lastSeq !== null ? lastSeq : "—"}</span>
        </div>

        <div className={styles.statusItem}>
          <strong>P0:</strong>
          <span className={ordering.ok ? styles.p0Ok : styles.p0Error}>
            {ordering.ok ? "✅ ok" : "❌ violated"}
          </span>
        </div>

        {(ordering.dupes > 0 || ordering.gaps > 0 || ordering.rewinds > 0) && (
          <div className={styles.violations}>
            <span>Violations:</span>
            {ordering.dupes > 0 && <span>dupes={ordering.dupes}</span>}
            {ordering.gaps > 0 && <span>gaps={ordering.gaps}</span>}
            {ordering.rewinds > 0 && <span>rewinds={ordering.rewinds}</span>}
          </div>
        )}

        {error && <div className={styles.error}>⚠️ {error.message}</div>}

        <button onClick={reset} className={styles.resetBtn}>
          Reset
        </button>
      </div>

      {/* Events list */}
      <div className={styles.eventsList}>
        {events.length === 0 ? (
          <div className={styles.emptyState}>
            {status === "connecting" ? "Connecting..." : "No events yet"}
          </div>
        ) : (
          events.map((event, idx) => (
            <div
              key={`${event.turnId}-${event.seq}`}
              className={`${styles.eventItem} ${idx % 2 === 0 ? styles.even : styles.odd}`}
            >
              <div className={styles.eventHeader}>
                <span className={styles.seqBadge}>[{event.seq}]</span>
                <span className={styles.turnId}>{event.turnId}</span>
                <span className={styles.eventType}>{event.type}</span>
              </div>
              {Object.entries(event).map(([k, v]) => {
                if (["type", "turnId", "seq", "ts_utc"].includes(k)) return null;
                return (
                  <div key={k} className={styles.eventField}>
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
        <div className={styles.inputContainer}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            disabled={isRequesting || status !== "open"}
            className={styles.input}
          />
          <button
            onClick={handleSend}
            disabled={isRequesting || !input.trim() || status !== "open"}
            className={`${styles.sendBtn} ${isRequesting ? styles.sending : ""}`}
          >
            {isRequesting ? "Sending…" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
