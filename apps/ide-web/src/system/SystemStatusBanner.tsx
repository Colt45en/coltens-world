/**
 * SystemStatusBanner — Sticky header showing service health
 *
 * Renders:
 * - WebSocket connection state
 * - Nucleus, Brain, Lexicon health dots
 * - Last update timestamp
 *
 * Neon-styled with glowing indicators. Consumed by NeonNexusLayout.
 */

import React from "react";
import { cn } from "../lib/cn";
import { useSystemStatus } from "./SystemStatusContext";

function Dot({ state }: { state: "ok" | "bad" | "idle" }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full transition-all",
        state === "ok" && "bg-[var(--neon-green)] shadow-[0_0_12px_rgba(0,255,102,0.6)]",
        state === "bad" && "bg-red-500 shadow-[0_0_12px_rgba(255,0,0,0.5)]",
        state === "idle" && "bg-[rgba(255,255,255,0.35)]",
      )}
    />
  );
}

export function SystemStatusBanner() {
  const { status } = useSystemStatus();

  // Map WS state to indicator
  const wsDot = status.ws === "connected" ? "ok" : status.ws === "connecting" ? "idle" : "bad";

  // Map service health to indicator
  const healthDot = (h: "up" | "down" | "unknown") =>
    h === "up" ? "ok" : h === "unknown" ? "idle" : "bad";

  return (
    <div className="sticky top-0 z-50 w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        {/* Service indicators */}
        <div className="flex items-center gap-3">
          {/* WebSocket */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.25)] px-3 py-1 backdrop-blur-sm">
            <span className="mr-2 text-xs opacity-70 font-mono">WS</span>
            <Dot state={wsDot} />
          </div>

          {/* Service health */}
          <div className="flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.25)] px-3 py-1 backdrop-blur-sm">
            <span className="text-xs opacity-70 font-mono">Nucleus</span>
            <Dot state={healthDot(status.nucleus)} />

            <span className="ml-2 text-xs opacity-70 font-mono">Brain</span>
            <Dot state={healthDot(status.brain)} />

            <span className="ml-2 text-xs opacity-70 font-mono">Lexicon</span>
            <Dot state={healthDot(status.lexicon)} />
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-xs opacity-60 font-mono">
          {new Date(status.updatedAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
