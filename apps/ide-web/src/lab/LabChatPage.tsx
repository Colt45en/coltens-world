import { Activity, Bot, Brain, Cable, Cpu, Database, MessageCircle, Network, Send, Zap } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSystemStatus } from "../system/SystemStatusContext";
import { ChatUI } from "../ui/ChatUI";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

export function LabChatPage() {
  const navigate = useNavigate();
  const { status } = useSystemStatus();
  const [chatStatus, setChatStatus] = useState<"idle" | "streaming" | "error">("idle");

  const handleChatError = (err: string) => {
    setChatStatus("error");
    console.error("[Chat Lab] Error:", err);
  };

  const wsConnected = status.ws === "connected";

  const systemHealth = useMemo(
    () => [
      { label: "Nucleus", value: status.nucleus, icon: Network },
      { label: "Brain", value: status.brain, icon: Brain },
      { label: "Lexicon", value: status.lexicon, icon: Database },
    ],
    [status.brain, status.lexicon, status.nucleus],
  );

  const healthClass = (value: "up" | "down" | "unknown") => {
    if (value === "up") return "text-green-300 border-green-500/30 bg-green-500/10";
    if (value === "down") return "text-red-300 border-red-500/30 bg-red-500/10";
    return "text-slate-300 border-slate-500/30 bg-slate-500/10";
  };

  return (
    <div className="relative min-h-[calc(100vh-140px)] overflow-hidden rounded-2xl border border-cyan-500/10 bg-[#020617] text-slate-100 selection:bg-cyan-500/30">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(6,182,212,0.14),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.12),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="relative z-10 flex min-h-[calc(100vh-140px)] flex-col md:flex-row">
        <aside className="w-full md:w-96 flex flex-col border-r border-cyan-500/10 bg-black/30 backdrop-blur-md">
          <div className="border-b border-cyan-500/10 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/20">
                  <Bot className="text-cyan-300" size={18} />
                </div>
                <div>
                  <div className="font-bold tracking-wide text-white">
                    FUSION CHAT <span className="ml-1 text-xs text-cyan-400">BRAIN/NEXUS</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-cyan-300/80">
                    <span
                      className={`h-2 w-2 rounded-full ${wsConnected ? "bg-cyan-400 animate-pulse" : "bg-red-400"}`}
                    />
                    {wsConnected ? "Connected" : "Offline"}
                  </div>
                </div>
              </div>
              <NeonButton variant="ghost" onClick={() => navigate("/?home=1")}>
                Back
              </NeonButton>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-4">
            <ChatUI userId="lab-user" convoId="chat-session" onError={handleChatError} />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <GlassPanel className="rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <NeonTitle as="h2" className="text-3xl flex items-center gap-2">
                    <Cpu className="text-cyan-300" size={28} /> SYSTEM CORE
                  </NeonTitle>
                  <p className="mt-2 text-white/60">
                    World Engine chat interface with Nucleus websocket routing and Brain stream
                    execution.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 font-mono text-xs">
                  <div className="text-white/50">Session Status</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-white">
                    <Activity size={14} className={wsConnected ? "text-cyan-300" : "text-red-300"} />
                    {chatStatus === "idle" && "Ready"}
                    {chatStatus === "streaming" && "Streaming"}
                    {chatStatus === "error" && "Error"}
                  </div>
                </div>
              </div>
            </GlassPanel>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {systemHealth.map((item) => (
                <GlassPanel key={item.label} className="rounded-xl p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-white/80">
                    <item.icon size={16} className="text-cyan-300" />
                    {item.label}
                  </div>
                  <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${healthClass(item.value)}`}>
                    {item.value.toUpperCase()}
                  </div>
                </GlassPanel>
              ))}
            </div>

            <GlassPanel className="rounded-2xl p-5">
              <h3 className="mb-3 text-sm font-bold tracking-widest text-cyan-300">CHANNELS</h3>
              <div className="grid grid-cols-1 gap-3 text-xs font-mono text-white/70 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div className="text-white/50">Nucleus WS</div>
                  <div>ws://localhost:3000</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div className="text-white/50">Brain Stream</div>
                  <div>http://127.0.0.1:8001/chat/stream</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div className="text-white/50">Lexicon Ops</div>
                  <div>http://127.0.0.1:8001/brain/operator/list</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div className="text-white/50">Last Update</div>
                  <div>{new Date(status.updatedAt).toLocaleTimeString()}</div>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel className="rounded-2xl p-5">
              <h3 className="mb-2 text-sm font-bold tracking-widest text-cyan-300">FEATURES</h3>
              <div className="grid grid-cols-1 gap-3 text-xs text-white/65 md:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div className="mb-1 flex items-center gap-1 text-white">
                    <Send size={13} className="text-cyan-300" /> NDJSON Streaming
                  </div>
                  Token-by-token response streaming from Brain via Nucleus envelope routing.
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div className="mb-1 flex items-center gap-1 text-white">
                    <Zap size={13} className="text-amber-300" /> Tool Orchestration
                  </div>
                  Tool call/response loop with `tool.command.v1` and `tool.effect.v1` integration.
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div className="mb-1 flex items-center gap-1 text-white">
                    <MessageCircle size={13} className="text-indigo-300" /> Memory & Citations
                  </div>
                  Context, citations, and memory writes remain visible in the chat rail.
                </div>
              </div>
            </GlassPanel>

            <div className="text-xs text-white/45 font-mono flex items-center gap-2">
              <Cable size={12} /> Fusion theme attached to World Engine chat shell.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
