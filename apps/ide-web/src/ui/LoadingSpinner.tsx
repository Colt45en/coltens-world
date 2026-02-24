/**
 * LoadingSpinner - Animated loading indicators
 */

import React from "react";

export interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  variant?: "spinner" | "dots" | "pulse";
  text?: string;
}

export function LoadingSpinner({
  size = 40,
  color = "#64ffda",
  variant = "spinner",
  text,
}: LoadingSpinnerProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {variant === "spinner" && <Spinner size={size} color={color} />}
      {variant === "dots" && <Dots size={size} color={color} />}
      {variant === "pulse" && <Pulse size={size} color={color} />}

      {text && (
        <span style={{ color: "rgba(230, 241, 255, 0.6)", fontSize: 12, fontWeight: 500 }}>
          {text}
        </span>
      )}
    </div>
  );
}

function Spinner({ size, color }: { size: number; color: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `3px solid rgba(100, 255, 218, 0.1)`,
        borderTop: `3px solid ${color}`,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

function Dots({ size, color }: { size: number; color: string }) {
  const dotSize = size / 4;
  const gap = dotSize / 2;

  return (
    <div style={{ display: "flex", gap, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            background: color,
            animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Pulse({ size, color }: { size: number; color: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    />
  );
}

// Add keyframes to the document
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); opacity: 0.6; }
      40% { transform: scale(1); opacity: 1; }
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}
