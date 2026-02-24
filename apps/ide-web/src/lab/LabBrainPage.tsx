import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatUI } from "../ui/ChatUI";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import { OperatorResultsPanel } from "../ui/OperatorResultsPanel";
import { OperatorTrigger } from "../ui/OperatorTrigger";

export function LabBrainPage() {
  const navigate = useNavigate();
  const [brainStatus, setBrainStatus] = useState<"ready" | "error" | "connected">("ready");
  const [error, setError] = useState<string | null>(null);

  const handleChatError = (err: string) => {
    setError(err);
    setBrainStatus("error");
    console.error("[Brain Lab] Chat error:", err);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <NeonTitle as="h2" className="text-2xl">
              Brain Console
            </NeonTitle>
            <p className="text-white/60 mt-2">
              Real-time agentic reasoning engine with streaming responses, tool orchestration, and
              memory persistence.
            </p>
          </div>
          <NeonButton variant="ghost" onClick={() => navigate("/")} className="ml-4">
            Back
          </NeonButton>
        </div>

        {/* Status */}
        <div className="mt-4 flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              brainStatus === "ready"
                ? "bg-green-400"
                : brainStatus === "connected"
                  ? "bg-cyan-400"
                  : "bg-red-400"
            } animate-pulse`}
          />
          <span className="text-sm text-white/70">
            {brainStatus === "ready" && "Ready for queries"}
            {brainStatus === "connected" && "Stream active"}
            {brainStatus === "error" && `Error: ${error}`}
          </span>
          <span className="text-xs text-white/50">
            ws://localhost:3000 | Brain: http://localhost:8001
          </span>
        </div>
      </GlassPanel>

      {/* Chat UI */}
      <div style={{ height: "600px" }}>
        <ChatUI userId="lab-user" convoId="brain-session" onError={handleChatError} />
      </div>

      {/* Operator Trigger & Results */}
      <div className="grid grid-cols-2 gap-4">
        {/* Trigger Panel */}
        <GlassPanel className="rounded-2xl p-4">
          <OperatorTrigger />
        </GlassPanel>

        {/* Results Panel */}
        <GlassPanel className="rounded-2xl p-0">
          <div style={{ height: "400px" }}>
            <OperatorResultsPanel autoRefresh={true} refreshInterval={2000} />
          </div>
        </GlassPanel>
      </div>

      {/* Debug Info */}
      <GlassPanel className="rounded-2xl p-4">
        <details className="text-xs">
          <summary className="cursor-pointer text-white/50 hover:text-white/70">
            System Info
          </summary>
          <div className="mt-3 space-y-1 font-mono text-white/40">
            <div>Frontend: ws://localhost:3000 (Nucleus)</div>
            <div>Backend: http://localhost:8001/chat/stream (Brain)</div>
            <div>Protocol: @world-engine/protocol v1.0</div>
            <div>Features: streaming tokens, tool calls, citations, memory writes</div>
          </div>
        </details>
      </GlassPanel>
    </div>
  );
}
