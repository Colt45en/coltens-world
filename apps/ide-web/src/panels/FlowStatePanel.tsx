/**
 * FlowStatePanel.tsx - Main IDE UI for code flow visualization
 *
 * Integrates:
 * - Core analysis engine (computeFlowMetrics)
 * - Render layers (ringRenderer, orbitRenderer)
 * - Evidence system (crypto, session, download)
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  computeFlowMetrics,
  hashString32,
  makeRingParticles,
  drawRing,
  buildOrbitNodes,
  drawOrbit,
  buildHeatmapGrid,
  drawHeatmap,
  buildHistogramBars,
  drawHistogram,
  fitCanvasToElement,
  getOrCreateSessionId,
  sha256HexFromString,
  canonicalize,
  downloadJsonFile,
  dataUrlToBytes,
  sha256HexFromBytes,
  bytesToBase64,
  type RingParticle,
  type OrbitNode,
  type FlowVizFrame,
} from "@world-engine/flowstate";
import { useFlowstateBusEmit } from "../bus/useFlowstateBusEmit";
import { useFlowstateEvidenceStorage } from "../bus/useFlowstateEvidenceStorage";
import { useFlowstateMetrics } from "../bus/useFlowstateMetrics";

interface TraceEvent {
  t: number;
  event: string;
  data?: any;
}

interface FlowStatePanelProps {
  initialCode?: string;
  onTelemetry?: (metrics: any) => void;
  onEvidence?: (packet: any) => void;
  mode?: "ring" | "orbit" | "heatmap" | "histogram";
}

export const FlowStatePanel: React.FC<FlowStatePanelProps> = ({
  initialCode = "",
  onTelemetry,
  onEvidence,
  mode: initialMode = "ring",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emitBusTelemetry = useFlowstateBusEmit();
  const evidenceStorage = useFlowstateEvidenceStorage();
  const { recordAnalysis, recordEnrichment } = useFlowstateMetrics();
  const [code, setCode] = useState(initialCode);
  const [boost, setBoost] = useState(1.0);
  const [mode, setMode] = useState<"ring" | "orbit" | "heatmap" | "histogram">(
    initialMode
  );
  const [sessionId] = useState(() => getOrCreateSessionId());
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [particles, setParticles] = useState<RingParticle[]>(makeRingParticles());
  const [orbitNodes, setOrbitNodes] = useState<OrbitNode[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastMetrics, setLastMetrics] = useState<any>(null);

  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const smoothEnergyRef = useRef(0);
  const smoothTempoRef = useRef(0);

  const sessionHash = useRef(hashString32(sessionId));

  const addTrace = useCallback((event: string, data?: any) => {
    setTraceEvents((prev) => {
      const t = Math.round(tRef.current * 1000) / 1000;
      const updated = [...prev, { t, event, data }];
      return updated.slice(-500); // Keep last 500 events
    });
  }, []);

  // Analyze code
  const handleAnalyze = useCallback(async () => {
    try {
      const tStart = performance.now();
      const metrics = computeFlowMetrics({ code, topN: 12 });
      const analysisTime = performance.now() - tStart;

      setLastMetrics(metrics);
      addTrace("ANALYZE", { energy: metrics.energy, tempo: metrics.tempo, time: analysisTime });

      // Record analysis in metrics service
      recordAnalysis(sessionId, mode, code, metrics, analysisTime);

      // Emit to callbacks and bus
      onTelemetry?.(metrics);
      emitBusTelemetry(metrics, sessionId);

      // Call Nucleus endpoint for enrichment (non-blocking)
      let enrichStartTime = performance.now();
      try {
        addTrace("ENRICH_START");
        enrichStartTime = performance.now();

        const enrichResponse = await fetch("http://localhost:3000/api/flowstate/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, topN: 12, sessionId }),
        });

        const enrichTime = performance.now() - enrichStartTime;

        if (enrichResponse.ok) {
          const enrichData = await enrichResponse.json();
          if (enrichData.enrichment?.ok && enrichData.enrichment.entries?.length > 0) {
            addTrace("ENRICH_SUCCESS", {
              entryCount: enrichData.enrichment.entries.length,
              time: enrichTime
            });
            recordEnrichment(sessionId, "success", enrichTime, enrichData.enrichment.entries.length);
          } else {
            addTrace("ENRICH_PARTIAL", { msg: "No enrichment entries", time: enrichTime });
            recordEnrichment(sessionId, "failure", enrichTime, 0, "No entries returned");
          }
        } else {
          addTrace("ENRICH_ERROR", { status: enrichResponse.status, time: enrichTime });
          recordEnrichment(sessionId, "failure", enrichTime, 0, `HTTP ${enrichResponse.status}`);
        }
      } catch (e) {
        const enrichTime = performance.now() - enrichStartTime;
        addTrace("ENRICH_FAIL", { msg: String(e), time: enrichTime });
        recordEnrichment(sessionId, "timeout", enrichTime, 0, String(e));
      }

      // Rebuild visualization data
      if (mode === "orbit") {
        const nodes = buildOrbitNodes(metrics.topTokens, 800, 600, sessionHash.current);
        setOrbitNodes(nodes);
      }
    } catch (e) {
      addTrace("ERROR", { msg: String(e) });
    }
  }, [code, mode, sessionId, onTelemetry, emitBusTelemetry, recordAnalysis, recordEnrichment, addTrace]);

  // Export evidence packet
  const handleExport = useCallback(async () => {
    try {
      if (!canvasRef.current) {
        addTrace("EXPORT_ERROR", { msg: "No canvas" });
        return;
      }

      // Get canvas PNG as data URL
      const pngDataUrl = canvasRef.current.toDataURL("image/png", 0.95);
      const pngBytes = await dataUrlToBytes(pngDataUrl);
      const pngHash = await sha256HexFromBytes(pngBytes);

      // Canonical code hash
      const codeHash = await sha256HexFromString(code);

      // Metrics snapshot
      const metricsJson = canonicalize(lastMetrics || {});
      const metricsHash = await sha256HexFromString(metricsJson);

      // Trace log
      const traceJson = canonicalize(traceEvents);
      const traceHash = await sha256HexFromString(traceJson);

      // Evidence packet
      const packet = {
        sessionId,
        timestamp: new Date().toISOString(),
        mode,
        boost,
        hashes: {
          code: codeHash,
          metrics: metricsHash,
          trace: traceHash,
          png: pngHash,
        },
        attachments: {
          code: code.slice(0, 10000), // First 10k chars
          metrics: lastMetrics || {},
          traceLength: traceEvents.length,
          pngBase64: bytesToBase64(pngBytes),
        },
        trace: traceEvents.slice(-50), // Last 50 events in packet
      };

      downloadJsonFile(`flowstate-${sessionId}.json`, packet);
      evidenceStorage.addPacket(packet);
      addTrace("EXPORT_SUCCESS", { packetSize: JSON.stringify(packet).length });
      onEvidence?.(packet);
    } catch (e) {
      addTrace("EXPORT_FAIL", { msg: String(e) });
    }
  }, [code, sessionId, mode, boost, lastMetrics, traceEvents, onEvidence, addTrace]);

  // Reset
  const handleReset = useCallback(() => {
    setCode("");
    setBoost(1.0);
    setTraceEvents([]);
    setParticles(makeRingParticles());
    setOrbitNodes([]);
    setLastMetrics(null);
    tRef.current = 0;
    smoothEnergyRef.current = 0;
    smoothTempoRef.current = 0;
    addTrace("RESET");
  }, [addTrace]);

  // Seed new particles (deterministic based on code)
  const handleSeed = useCallback(() => {
    const newHash = hashString32(code);
    sessionHash.current = newHash;
    const newParticles = makeRingParticles();
    setParticles(newParticles);
    if (lastMetrics?.topTokens) {
      const nodes = buildOrbitNodes(lastMetrics.topTokens, 800, 600, newHash);
      setOrbitNodes(nodes);
    }
    addTrace("SEED", { hash: newHash });
  }, [code, lastMetrics?.topTokens, addTrace]);

  // Toggle boost
  const handleToggleBoost = useCallback(() => {
    setBoost((b) => (b === 1.0 ? 2.0 : 1.0));
    addTrace("BOOST_TOGGLE", { newBoost: boost === 1.0 ? 2.0 : 1.0 });
  }, [boost, addTrace]);

  // Animation RAF loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (!parent) return;

    const fit = fitCanvasToElement(parent, canvas);

    let running = true;

    const animate = () => {
      if (!running) return;

      tRef.current += 0.016; // ~60 FPS
      const metrics = lastMetrics || { energy: 0.1, tempo: 0.2, tension: 1 };

      // Smooth energy/tempo
      smoothEnergyRef.current += (metrics.energy - smoothEnergyRef.current) * 0.15;
      smoothTempoRef.current += (metrics.tempo - smoothTempoRef.current) * 0.1;

      const frame: FlowVizFrame = {
        t: tRef.current,
        energySmooth: smoothEnergyRef.current,
        tempoSmooth: smoothTempoRef.current,
        boost,
        tension: metrics.tension || 1,
        nodes: [],
      };

      // Render based on mode
      if (mode === "ring") {
        drawRing(fit, frame, particles);
      } else if (mode === "orbit") {
        drawOrbit(fit, frame, orbitNodes);
      } else if (mode === "heatmap") {
        if (lastMetrics?.topTokens) {
          const maxCount = lastMetrics.topTokens[0]?.count || 1;
          const grid = buildHeatmapGrid(lastMetrics.topTokens, maxCount, 6);
          drawHeatmap(fit, frame, grid, 6);
        }
      } else if (mode === "histogram") {
        if (lastMetrics?.topTokens) {
          const bars = buildHistogramBars(lastMetrics.topTokens, 12);
          drawHistogram(fit, frame, bars);
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      running = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [particles, orbitNodes, lastMetrics, boost, mode]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>FlowState © {sessionId}</h2>
        <div style={styles.modeLabel}>
          {
            {
              ring: "Ring",
              orbit: "Orbit",
              heatmap: "Heatmap",
              histogram: "Histogram",
            }[mode]
          }
        </div>
      </div>

      <div style={styles.mainArea}>
        <canvas ref={canvasRef} style={styles.canvas} />
        <div style={styles.editorPanel}>
          <textarea
            aria-label="Code input for FlowState analysis"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste code here..."
            style={styles.editor}
          />
        </div>
      </div>

      <div style={styles.controls}>
        <div style={styles.modePanel}>
          <button
            onClick={() =>
              setMode(
                "ring" as "ring" | "orbit" | "heatmap" | "histogram"
              )
            }
            style={{
              ...styles.modeButton,
              ...(mode === "ring"
                ? { background: "rgba(100, 255, 218, 0.3)" }
                : {}),
            }}
          >
            Ring
          </button>
          <button
            onClick={() =>
              setMode(
                "orbit" as "ring" | "orbit" | "heatmap" | "histogram"
              )
            }
            style={{
              ...styles.modeButton,
              ...(mode === "orbit"
                ? { background: "rgba(100, 255, 218, 0.3)" }
                : {}),
            }}
          >
            Orbit
          </button>
          <button
            onClick={() =>
              setMode(
                "heatmap" as "ring" | "orbit" | "heatmap" | "histogram"
              )
            }
            style={{
              ...styles.modeButton,
              ...(mode === "heatmap"
                ? { background: "rgba(100, 255, 218, 0.3)" }
                : {}),
            }}
          >
            Heatmap
          </button>
          <button
            onClick={() =>
              setMode(
                "histogram" as "ring" | "orbit" | "heatmap" | "histogram"
              )
            }
            style={{
              ...styles.modeButton,
              ...(mode === "histogram"
                ? { background: "rgba(100, 255, 218, 0.3)" }
                : {}),
            }}
          >
            Histogram
          </button>
        </div>

        <button onClick={handleAnalyze} style={styles.button}>
          Analyze
        </button>
        <button onClick={handleExport} style={styles.button}>
          Export
        </button>
        <button onClick={handleSeed} style={styles.button}>
          Seed
        </button>
        <button onClick={handleToggleBoost} style={styles.button}>
          Boost {boost === 1.0 ? "↑" : "↓"}
        </button>
        <button onClick={handleReset} style={styles.button}>
          Reset
        </button>
      </div>

      <div style={styles.tracePanel}>
        <div style={styles.traceHeader}>Trace ({traceEvents.length})</div>
        <div style={styles.traceContent}>
          {traceEvents.slice(-15).map((e, i) => (
            <div key={i} style={styles.traceEvent}>
              <span style={styles.traceTime}>{e.t.toFixed(1)}s</span>
              <span style={styles.traceType}>{e.event}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: "flex" as const,
    flexDirection: "column" as const,
    height: "100%",
    background: "#0a0e27",
    color: "#e6f1ff",
    fontFamily: "monospace",
    fontSize: 12,
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottom: "1px solid rgba(100, 255, 218, 0.15)",
    background: "rgba(10, 14, 39, 0.8)",
  } as React.CSSProperties,
  modeLabel: {
    fontSize: 11,
    color: "rgba(100, 255, 218, 0.6)",
  } as React.CSSProperties,
  mainArea: {
    display: "flex",
    flex: 1,
    gap: 12,
    padding: 12,
    minHeight: 0,
  } as React.CSSProperties,
  canvas: {
    flex: 1,
    background: "rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(100, 255, 218, 0.2)",
  } as React.CSSProperties,
  editorPanel: {
    flex: 0.8,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  } as React.CSSProperties,
  editor: {
    flex: 1,
    padding: 8,
    background: "rgba(0, 0, 0, 0.5)",
    color: "#e6f1ff",
    border: "1px solid rgba(100, 255, 218, 0.15)",
    fontFamily: "monospace",
    fontSize: 11,
    resize: "none" as const,
  } as React.CSSProperties,
  controls: {
    display: "flex",
    gap: 8,
    padding: 12,
    borderTop: "1px solid rgba(100, 255, 218, 0.15)",
    background: "rgba(10, 14, 39, 0.8)",
    justifyContent: "center",
  } as React.CSSProperties,
  button: {
    padding: "6px 12px",
    background: "rgba(100, 255, 218, 0.1)",
    color: "#64ffda",
    border: "1px solid rgba(100, 255, 218, 0.3)",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "monospace",
  } as React.CSSProperties,
  modePanel: {
    display: "flex",
    gap: 4,
    padding: "0 8px",
    borderRight: "1px solid rgba(100, 255, 218, 0.2)",
  } as React.CSSProperties,
  modeButton: {
    padding: "4px 8px",
    background: "rgba(100, 255, 218, 0.05)",
    color: "#64ffda",
    border: "1px solid rgba(100, 255, 218, 0.2)",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 10,
    fontFamily: "monospace",
    transition: "all 0.2s ease",
  } as React.CSSProperties,
  tracePanel: {
    display: "flex",
    flexDirection: "column" as const,
    maxHeight: 120,
    borderTop: "1px solid rgba(100, 255, 218, 0.15)",
    background: "rgba(0, 0, 0, 0.3)",
  } as React.CSSProperties,
  traceHeader: {
    padding: "6px 12px",
    fontSize: 10,
    color: "rgba(100, 255, 218, 0.5)",
    borderBottom: "1px solid rgba(100, 255, 218, 0.1)",
  } as React.CSSProperties,
  traceContent: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "4px 12px",
    fontSize: 10,
  } as React.CSSProperties,
  traceEvent: {
    display: "flex",
    gap: 8,
    lineHeight: 1.4,
    color: "rgba(230, 241, 255, 0.5)",
  } as React.CSSProperties,
  traceTime: {
    color: "rgba(100, 255, 218, 0.4)",
    minWidth: 40,
  } as React.CSSProperties,
  traceType: {
    color: "rgba(100, 255, 218, 0.6)",
  } as React.CSSProperties,
};
