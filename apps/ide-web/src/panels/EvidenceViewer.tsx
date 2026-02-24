/**
 * EvidenceViewer.tsx - View stored FlowState evidence packets
 *
 * Shows:
 * - List of packets per session
 * - Details: timestamps, hashes, metrics, trace
 * - Actions: delete, reanalyze, export
 */

import React, { useMemo } from "react";
import { useFlowstateEvidenceStorage } from "../bus/useFlowstateEvidenceStorage";
import styles from "./EvidenceViewer.module.css";

export const EvidenceViewer: React.FC = () => {
  const { packets, loaded, removePacket, clearAll } = useFlowstateEvidenceStorage();

  const bySession = useMemo(() => {
    const map = new Map<string, typeof packets>();
    for (const p of packets) {
      if (!map.has(p.sessionId)) {
        map.set(p.sessionId, []);
      }
      map.get(p.sessionId)!.push(p);
    }
    return map;
  }, [packets]);

  if (!loaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading evidence storage...</div>
      </div>
    );
  }

  if (packets.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No Evidence Packets</h2>
          <p>Run FlowState analysis and click "Export" to store evidence packets here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Evidence Storage ({packets.length} packets)</h2>
        <button onClick={clearAll} className={styles.clearButton}>
          Clear All
        </button>
      </div>

      {Array.from(bySession.entries()).map(([sessionId, sessionPackets]) => (
        <div key={sessionId} className={styles.sessionGroup}>
          <div className={styles.sessionTitle}>Session: {sessionId}</div>
          {sessionPackets.map((packet) => (
            <div key={packet.id} className={styles.packet}>
              <div className={styles.packetHeader}>
                <div>
                  <strong>{packet.timestamp}</strong>
                  <span className={styles.mode}>{packet.mode}</span>
                  <span className={styles.boost}>boost: {packet.boost.toFixed(1)}x</span>
                </div>
                <button
                  onClick={() => removePacket(packet.id)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>

              <div className={styles.packetDetails}>
                <div className={styles.detailRow}>
                  <span>Code Hash:</span>
                  <code>{(packet.hashes.code ?? "N/A").slice(0, 16)}...</code>
                </div>
                <div className={styles.detailRow}>
                  <span>Metrics Hash:</span>
                  <code>{(packet.hashes.metrics ?? "N/A").slice(0, 16)}...</code>
                </div>
                <div className={styles.detailRow}>
                  <span>PNG Hash:</span>
                  <code>{(packet.hashes.png ?? "N/A").slice(0, 16)}...</code>
                </div>
                <div className={styles.detailRow}>
                  <span>Trace Events:</span>
                  <code>{packet.trace.length}</code>
                </div>
                <div className={styles.detailRow}>
                  <span>Stored:</span>
                  <code>
                    {new Date(packet.storedAt).toLocaleString()}
                  </code>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
