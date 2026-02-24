import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import * as THREE from "three/webgpu";

import { EnvelopeSchema } from "@world-engine/engine";
import type { BusEnvelope, MessageMap } from "@world-engine/protocol";
import { GameScene } from "./GameScene";
import { env } from "./protocol";

/**
 * WebGPU + R3F integration for 100k entity rendering
 * - Async WebGPU renderer init
 * - Fallback to Three.js if WebGPU unavailable
 * - R3F v9 Canvas with proper gl factory
 */

const hud = document.getElementById("hud")!;
const root = document.getElementById("root")!;

// Global state for Nucleus connection
let sessionId = "local";
let instanceId = "preview_1";
let playerId = "";
let nuclearWs: WebSocket | null = null;

function App() {
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to Nucleus (control messages)
    nuclearWs = new WebSocket("ws://localhost:3000");

    nuclearWs.onopen = () => {
      console.log("[preview] Connecting to Nucleus...");
      nuclearWs!.send(
        JSON.stringify(env(sessionId, instanceId, "system.hello", { requestedRole: "preview" })),
      );
    };

    nuclearWs.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(String(evt.data));
        const checked = EnvelopeSchema.safeParse(parsed);
        if (!checked.success) return;

        const e = checked.data as any;
        if (e.type === "system.welcome") {
          const wel = e as BusEnvelope<"system.welcome", MessageMap["system.welcome"]>;
          sessionId = wel.sessionId;
          instanceId = wel.payload.assignedInstanceId;
          setStatus("ready");
          console.log(`[preview] ✅ Connected as ${instanceId}`);
          hud.innerHTML = `<div style="color: #0f0">preview ✅ ${instanceId}</div>`;
        }
      } catch (err) {
        console.error("[preview] WS parse error:", err);
      }
    };

    nuclearWs.onerror = (err) => {
      console.error("[preview] Nucleus connection error:", err);
      setStatus("error");
      setError("Failed to connect to Nucleus");
    };

    nuclearWs.onclose = () => {
      console.warn("[preview] Nucleus disconnected");
      setStatus("error");
    };

    return () => {
      nuclearWs?.close();
    };
  }, []);

  if (status === "error") {
    return <div style={{ color: "#f00", padding: "20px" }}>Error: {error || "Unknown"}</div>;
  }

  return (
    <Canvas
      gl={async (props) => {
        console.log("[webgpu] Initializing WebGPU renderer...");
        try {
          // WebGPU renderer init (async as per R3F v9 docs)
          const renderer = new THREE.WebGPURenderer({
            ...props,
            antialias: true,
          } as any);
          await renderer.init();
          console.log("[webgpu] ✅ WebGPU renderer initialized");
          return renderer;
        } catch (err) {
          console.error("[webgpu] WebGPU init failed, falling back:", err);
          // Fallback to WebGL if WebGPU unavailable
          return new THREE.WebGLRenderer(props);
        }
      }}
      // Performance tuning
      dpr={[1, 1.5]}
      shadows={false}
      // Matching preview-runtime rendering loop expectations
      frameloop="always"
    >
      <Suspense fallback={null}>
        <GameScene sessionId={sessionId} instanceId={instanceId} />
      </Suspense>
    </Canvas>
  );
}

ReactDOM.createRoot(root).render(<App />);

export function getWs(): WebSocket | null {
  return nuclearWs;
}

export { instanceId, playerId, sessionId };
