/**
 * useFlowstateMetricsService.ts - Global metrics tracking for flowstate
 *
 * Maintains real-time statistics:
 * - Total analyses + enrichments
 * - Success/failure rates
 * - Performance metrics (latency)
 * - Session tracking
 */

import { useCallback, useState, useEffect } from "react";

export interface SessionMetrics {
  sessionId: string;
  timestamp: string;
  mode: "ring" | "orbit" | "heatmap" | "histogram";
  analysisTime: number;
  codeLength: number;
  tokenCount: number;
  energy: number;
  tempo: number;
  tension: number;
  enrichmentStatus: "pending" | "success" | "failure" | "timeout";
  enrichmentTime?: number;
  entryCount?: number;
  error?: string;
}

export interface AggregateMetrics {
  totalAnalyses: number;
  totalEnrichments: number;
  successfulEnrichments: number;
  failedEnrichments: number;
  pendingEnrichments: number;
  averageAnalysisTime: number;
  averageEnrichmentTime: number;
  averageTokens: number;
  enrichmentSuccessRate: number;
  lastAnalysisTime: number | undefined;
  sessions: SessionMetrics[];
}

const MAX_SESSIONS = 100; // Keep last 100 sessions in memory

class FlowstateMetricsService {
  private readonly sessions: Map<string, SessionMetrics> = new Map();
  private readonly listeners: Set<(_metrics: AggregateMetrics) => void> = new Set();

  subscribe(callback: (_metrics: AggregateMetrics) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    const aggregate = this.getAggregate();
    this.listeners.forEach((cb) => cb(aggregate));
  }

  recordAnalysis(
    sessionId: string,
    mode: "ring" | "orbit" | "heatmap" | "histogram",
    code: string,
    metrics: any,
    analysisTime: number
  ): void {
    const session: SessionMetrics = {
      sessionId,
      timestamp: new Date().toISOString(),
      mode,
      analysisTime,
      codeLength: code.length,
      tokenCount: metrics.tokenCount || 0,
      energy: metrics.energy || 0,
      tempo: metrics.tempo || 0,
      tension: metrics.tension || 0,
      enrichmentStatus: "pending",
    };

    this.sessions.set(sessionId, session);

    // Evict oldest if at capacity
    if (this.sessions.size > MAX_SESSIONS) {
      const oldest = Array.from(this.sessions.entries()).at(0);
      if (oldest) {
        this.sessions.delete(oldest[0]);
      }
    }

    this.notifyListeners();
  }

  recordEnrichment(
    sessionId: string,
    status: "success" | "failure" | "timeout",
    enrichmentTime: number,
    entryCount?: number,
    error?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.enrichmentStatus = status;
      session.enrichmentTime = enrichmentTime;
      if (entryCount !== undefined) session.entryCount = entryCount;
      if (error) session.error = error;
    }

    this.notifyListeners();
  }

  getAggregate(): AggregateMetrics {
    const sessions = Array.from(this.sessions.values());

    const totalAnalyses = sessions.length;
    const enrichments = sessions.filter((s) => s.enrichmentStatus !== "pending");
    const successfulEnrichments = sessions.filter(
      (s) => s.enrichmentStatus === "success"
    ).length;
    const failedEnrichments = sessions.filter(
      (s) => s.enrichmentStatus === "failure" || s.enrichmentStatus === "timeout"
    ).length;
    const pendingEnrichments = sessions.filter(
      (s) => s.enrichmentStatus === "pending"
    ).length;

    const totalAnalysisTime = sessions.reduce((sum, s) => sum + s.analysisTime, 0);
    const totalEnrichmentTime = sessions.reduce(
      (sum, s) => sum + (s.enrichmentTime || 0),
      0
    );
    const totalTokens = sessions.reduce((sum, s) => sum + s.tokenCount, 0);

    return {
      totalAnalyses,
      totalEnrichments: enrichments.length,
      successfulEnrichments,
      failedEnrichments,
      pendingEnrichments,
      averageAnalysisTime: totalAnalyses ? totalAnalysisTime / totalAnalyses : 0,
      averageEnrichmentTime: enrichments.length ? totalEnrichmentTime / enrichments.length : 0,
      averageTokens: totalAnalyses ? totalTokens / totalAnalyses : 0,
      enrichmentSuccessRate:
        enrichments.length > 0
          ? (successfulEnrichments / enrichments.length) * 100
          : 0,
      lastAnalysisTime: sessions.at(-1)?.analysisTime,
      sessions: sessions.slice(-20), // Last 20 for display
    };
  }

  clear(): void {
    this.sessions.clear();
    this.notifyListeners();
  }
}

// Global singleton
const metricsService = new FlowstateMetricsService();

export function useFlowstateMetrics() {
  const [aggregate, setAggregate] = useState<AggregateMetrics>(
    metricsService.getAggregate()
  );

  useEffect(() => {
    const unsubscribe = metricsService.subscribe(setAggregate);
    return unsubscribe;
  }, []);

  return {
    metrics: aggregate,
    recordAnalysis: useCallback(
      (
        sessionId: string,
        mode: "ring" | "orbit" | "heatmap" | "histogram",
        code: string,
        flowMetrics: any,
        analysisTime: number
      ) => {
        metricsService.recordAnalysis(sessionId, mode, code, flowMetrics, analysisTime);
      },
      []
    ),
    recordEnrichment: useCallback(
      (
        sessionId: string,
        status: "success" | "failure" | "timeout",
        enrichmentTime: number,
        entryCount?: number,
        error?: string
      ) => {
        metricsService.recordEnrichment(
          sessionId,
          status,
          enrichmentTime,
          entryCount,
          error
        );
      },
      []
    ),
    clearMetrics: useCallback(() => {
      metricsService.clear();
    }, []),
  };
}
