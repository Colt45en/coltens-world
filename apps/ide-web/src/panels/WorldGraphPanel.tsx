import {
  EnvelopeSchema,
  randomId,
  type BusEnvelope,
  type MessageMap,
} from "@world-engine/protocol";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";

type GraphEvent = {
  id: string;
  ts: number;
  level: "info" | "warning" | "success" | "error";
  message: string;
};

type NodePos = { x: number; y: number };

const WS_URL = "ws://localhost:3000";

export function WorldGraphPanel() {
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState("world_graph_local");
  const [instanceId, setInstanceId] = useState("ide_world_graph");
  const [sessionToken, setSessionToken] = useState("");

  const [speed, setSpeed] = useState(1);
  const [description, setDescription] = useState(
    "entity Player\nentity NPC\nsystem movement every 1\nsystem collision every 1",
  );

  const [worldState, setWorldState] = useState<MessageMap["world.graph.world_state"]["state"] | null>(
    null,
  );
  const [events, setEvents] = useState<GraphEvent[]>([]);

  const pushEvent = (level: GraphEvent["level"], message: string) => {
    setEvents((prev) => [
      {
        id: randomId("wg_evt"),
        ts: Date.now(),
        level,
        message,
      },
      ...prev,
    ].slice(0, 80));
  };

  const sendEnvelope = <T extends keyof MessageMap>(type: T, payload: MessageMap[T]) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionToken) return;

    const env: BusEnvelope<T, MessageMap[T]> = {
      v: 2,
      id: randomId("cli"),
      type,
      ts: Date.now(),
      from: { role: "ide", instanceId },
      sessionId,
      nonce: randomId("nonce"),
      auth: { kind: "session", token: sessionToken },
      payload,
    };

    ws.send(JSON.stringify(env));
  };

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      pushEvent("success", `Connected to ${WS_URL}`);

      ws.send(
        JSON.stringify({
          v: 2,
          id: randomId("hello"),
          type: "system.hello",
          ts: Date.now(),
          from: { role: "ide", instanceId },
          sessionId,
          payload: { requestedRole: "ide" },
        }),
      );
    };

    ws.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }

      const checked = EnvelopeSchema.safeParse(parsed);
      if (!checked.success) return;
      const env = checked.data as BusEnvelope<string, unknown>;

      if (env.type === "system.welcome") {
        setSessionId(env.sessionId);
        setSessionToken((env.auth as { token?: string } | undefined)?.token ?? "");
        setInstanceId((env.payload as { assignedInstanceId?: string } | undefined)?.assignedInstanceId ?? instanceId);
        pushEvent("success", "World Graph handshake complete");
        return;
      }

      if (env.type === "world.graph.world_state") {
        const payload = env.payload as MessageMap["world.graph.world_state"];
        setWorldState(payload.state);
        return;
      }

      if (env.type === "world.graph.simulation_step") {
        const payload = env.payload as MessageMap["world.graph.simulation_step"];
        setWorldState(payload.world_state);
        return;
      }

      if (env.type === "world.graph.simulation_event") {
        const payload = env.payload as MessageMap["world.graph.simulation_event"];
        pushEvent(payload.event.level, payload.event.message);
        return;
      }

      if (env.type === "world.graph.success") {
        const payload = env.payload as MessageMap["world.graph.success"];
        pushEvent("success", payload.message);
        return;
      }

      if (env.type === "world.graph.error") {
        const payload = env.payload as MessageMap["world.graph.error"];
        pushEvent("error", payload.message);
      }
    };

    ws.onerror = () => {
      pushEvent("error", "World Graph websocket error");
    };

    ws.onclose = () => {
      setConnected(false);
      setSessionToken("");
      pushEvent("warning", "Disconnected from Nucleus");
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    sendEnvelope("world.graph.get_world_state", {});
  }, [sessionToken]);

  const graphNodes = useMemo(() => {
    const nodes: Array<{ id: string; label: string; kind: "entity" | "system"; index: number }> = [];

    for (const [index, entity] of (worldState?.entities ?? []).entries()) {
      nodes.push({ id: entity.id, label: entity.name, kind: "entity", index });
    }

    for (const [index, system] of (worldState?.systems ?? []).entries()) {
      nodes.push({ id: `system:${system.name}`, label: system.name, kind: "system", index });
    }

    return nodes;
  }, [worldState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const positions = new Map<string, NodePos>();
    const centerX = () => canvas.width / 2;
    const centerY = () => canvas.height / 2;

    for (const [index, node] of graphNodes.entries()) {
      const radius = node.kind === "entity" ? 150 : 90;
      const angle = (Math.PI * 2 * index) / Math.max(graphNodes.length, 1);
      positions.set(node.id, {
        x: centerX() + Math.cos(angle) * radius,
        y: centerY() + Math.sin(angle) * radius,
      });
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#060b1b";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const entities = worldState?.entities ?? [];
    const systems = worldState?.systems ?? [];

    for (const system of systems) {
      const systemPos = positions.get(`system:${system.name}`);
      if (!systemPos) continue;
      for (const entity of entities) {
        const entityPos = positions.get(entity.id);
        if (!entityPos) continue;

        context.beginPath();
        context.moveTo(systemPos.x, systemPos.y);
        context.lineTo(entityPos.x, entityPos.y);
        context.strokeStyle = "rgba(88, 166, 255, 0.2)";
        context.lineWidth = 1;
        context.stroke();
      }
    }

    for (const node of graphNodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const radius = node.kind === "entity" ? 18 : 14;
      context.beginPath();
      context.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      context.fillStyle = node.kind === "entity" ? "#22c55e" : "#38bdf8";
      context.fill();

      context.fillStyle = "#e2e8f0";
      context.font = "12px sans-serif";
      context.textAlign = "center";
      context.fillText(node.label, pos.x, pos.y + radius + 14);
    }

    observer.disconnect();
  }, [graphNodes, worldState]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <GlassPanel className="rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <NeonTitle as="h2" className="text-2xl">
              World Graph Panel
            </NeonTitle>
            <div className="text-white/60 text-sm mt-1">
              Typed WS bridge: decode world DSL, stream sim steps, visualize entities/systems.
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs border ${connected ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
            {connected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>
      </GlassPanel>

      <GlassPanel className="rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <NeonButton variant="ghost" onClick={() => sendEnvelope("world.graph.get_world_state", {})}>
            Refresh
          </NeonButton>
          <NeonButton onClick={() => sendEnvelope("world.graph.start_simulation", { speed })}>
            Start
          </NeonButton>
          <NeonButton variant="ghost" onClick={() => sendEnvelope("world.graph.pause_simulation", {})}>
            Pause
          </NeonButton>
          <NeonButton variant="ghost" onClick={() => sendEnvelope("world.graph.reset_world", {})}>
            Reset
          </NeonButton>
          <NeonButton variant="ghost" onClick={() => sendEnvelope("world.graph.set_speed", { speed })}>
            Set Speed
          </NeonButton>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="world-graph-speed" className="text-xs text-white/70 font-mono">
            Speed
          </label>
          <input
            id="world-graph-speed"
            type="number"
            min={0.1}
            step={0.1}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value) || 1)}
            className="bg-slate-900/70 border border-white/15 rounded px-2 py-1 text-sm w-24"
            title="Simulation speed"
          />
        </div>

        <textarea
          aria-label="World graph description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
          className="w-full bg-slate-900/70 border border-white/15 rounded p-2 text-sm font-mono"
          placeholder="entity Player\nentity NPC\nsystem movement every 1"
        />

        <div>
          <NeonButton onClick={() => sendEnvelope("world.graph.generate_world", { description })}>
            Generate World
          </NeonButton>
        </div>
      </GlassPanel>

      <GlassPanel className="rounded-2xl p-4">
        <div className="text-xs text-white/60 mb-2 font-mono">
          time={worldState?.time.toFixed(2) ?? "0.00"} · entities={worldState?.entities.length ?? 0} · systems={worldState?.systems.length ?? 0} · events={worldState?.events_processed ?? 0}
        </div>
        <canvas ref={canvasRef} className="w-full h-[360px] rounded border border-white/10" />
      </GlassPanel>

      <GlassPanel className="rounded-2xl p-4">
        <div className="font-mono text-xs text-white/60 mb-2">World Graph Events</div>
        <div className="max-h-52 overflow-y-auto space-y-1">
          {events.map((event) => (
            <div key={event.id} className="text-xs font-mono text-white/75">
              [{new Date(event.ts).toLocaleTimeString()}] {event.level.toUpperCase()}: {event.message}
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
