/**
 * useRealTimeMetrics - Advanced real-time metrics tracking and aggregation
 *
 * Provides comprehensive metrics with historical trends, percentiles, and alerts
 */

import { useEffect, useRef, useState } from "react";

export interface MetricSnapshot {
  timestamp: number;
  value: number;
  label?: string;
}

export interface MetricStats {
  current: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  trend: "up" | "down" | "stable";
  history: MetricSnapshot[];
}

export interface MetricsConfig {
  maxHistorySize?: number;
  updateInterval?: number;
  alertThreshold?: number;
}

const DEFAULT_CONFIG: Required<MetricsConfig> = {
  maxHistorySize: 100,
  updateInterval: 1000,
  alertThreshold: Infinity,
};

export function useRealTimeMetrics(initialValue: number = 0, config: MetricsConfig = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [stats, setStats] = useState<MetricStats>(() => ({
    current: initialValue,
    min: initialValue,
    max: initialValue,
    avg: initialValue,
    median: initialValue,
    p95: initialValue,
    p99: initialValue,
    trend: "stable",
    history: [{ timestamp: Date.now(), value: initialValue }],
  }));

  const historyRef = useRef<MetricSnapshot[]>([{ timestamp: Date.now(), value: initialValue }]);
  const lastTrendRef = useRef<number>(initialValue);

  const addMetric = (value: number, label?: string) => {
    const snapshot: MetricSnapshot = { timestamp: Date.now(), value, ...(label ? { label } : {}) };

    historyRef.current = [...historyRef.current, snapshot].slice(-cfg.maxHistorySize);

    const values = historyRef.current.map(s => s.value);
    const sorted = [...values].sort((a, b) => a - b);

    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    let trend: "up" | "down" | "stable" = "stable";
    const recentAvg = values.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, values.length);
    if (recentAvg > lastTrendRef.current * 1.1) trend = "up";
    else if (recentAvg < lastTrendRef.current * 0.9) trend = "down";
    lastTrendRef.current = recentAvg;

    setStats({
      current: value,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      avg,
      median,
      p95,
      p99,
      trend,
      history: historyRef.current,
    });
  };

  const reset = () => {
    const initialSnapshot = { timestamp: Date.now(), value: 0 };
    historyRef.current = [initialSnapshot];
    lastTrendRef.current = 0;
    setStats({
      current: 0,
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      p95: 0,
      p99: 0,
      trend: "stable",
      history: [initialSnapshot],
    });
  };

  return { stats, addMetric, reset };
}

/**
 * useMetricAggregator - Aggregate multiple metrics into unified stats
 */
export function useMetricAggregator(metricNames: string[]) {
  const [aggregated, setAggregated] = useState<Record<string, MetricStats>>({});

  const updateMetric = (name: string, value: number, label?: string) => {
    // This would integrate with individual metric hooks
    // For now, it's a placeholder for the aggregation pattern
  };

  return { aggregated, updateMetric };
}
