/**
 * AdvancedMetricsCard - Rich metrics display with sparklines and trends
 */

import React from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { GlassPanel } from "./neon";

export interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "stable";
  trendValue?: number;
  history?: number[];
  color?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  alert?: "success" | "warning" | "error";
}

export function AdvancedMetricsCard({
  label,
  value,
  unit,
  trend = "stable",
  trendValue,
  history = [],
  color = "#64ffda",
  icon,
  subtitle,
  alert,
}: MetricCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor =
    trend === "up" ? "#64c896" : trend === "down" ? "#ff6b6b" : "#6495ed";

  const alertColors = {
    success: "rgba(100, 200, 150, 0.15)",
    warning: "rgba(255, 165, 0, 0.15)",
    error: "rgba(255, 107, 107, 0.15)",
  };

  const alertBorders = {
    success: "rgba(100, 200, 150, 0.3)",
    warning: "rgba(255, 165, 0, 0.3)",
    error: "rgba(255, 107, 107, 0.3)",
  };

  return (
    <GlassPanel
      style={{
        padding: 16,
        borderRadius: 12,
        background: alert ? alertColors[alert] : undefined,
        border: alert ? `1px solid ${alertBorders[alert]}` : undefined,
        transition: "all 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {icon && <div style={{ color, fontSize: 20 }}>{icon}</div>}
            <span style={{ fontSize: 11, color: "rgba(230, 241, 255, 0.6)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>
              {label}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: "bold", color, lineHeight: 1 }}>
              {typeof value === "number" ? value.toFixed(2) : value}
            </span>
            {unit && (
              <span style={{ fontSize: 12, color: "rgba(230, 241, 255, 0.5)" }}>
                {unit}
              </span>
            )}
          </div>

          {subtitle && (
            <div style={{ fontSize: 10, color: "rgba(230, 241, 255, 0.4)", marginTop: 4 }}>
              {subtitle}
            </div>
          )}
        </div>

        {trend !== "stable" && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <TrendIcon size={16} style={{ color: trendColor }} />
            {trendValue !== undefined && (
              <span style={{ fontSize: 12, fontWeight: "bold", color: trendColor }}>
                {trendValue > 0 ? "+" : ""}{trendValue.toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Sparkline data={history} color={color} height={32} />
        </div>
      )}
    </GlassPanel>
  );
}

interface SparklineProps {
  data: number[];
  color: string;
  height: number;
}

function Sparkline({ data, color, height }: SparklineProps) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  return (
    <svg width="100%" height={height} style={{ display: "block" }}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.8 }}
      />
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${height} ${points.join(" ")} 100,${height}`}
        fill={`url(#gradient-${color})`}
        stroke="none"
      />
    </svg>
  );
}
