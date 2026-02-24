import { PredictionEngine } from "@world-engine/engine";
import type { BusEnvelope, MessageMap } from "@world-engine/protocol";
import { EnvelopeSchema } from "@world-engine/protocol";
import { env } from "./protocol";

interface SimEntity {
  id: string;
  pos: { x: number; y: number };
  vel: { x: number; y: number };
}

interface BoxCollider {
  type: "box";
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SimWorldMetadata {
  type: "sim.worldMetadata";
  payload: {
    levelId: string;
    staticColliders: BoxCollider[];
  };
}

interface SimSnapshot {
  type: "sim.snapshot";
  payload: {
    tick: number;
    entities: SimEntity[];
  };
}

type SimMessage = SimWorldMetadata | SimSnapshot | { type: string; payload: unknown };

const hud = document.getElementById("hud")!;
const root = document.getElementById("root")!;

const canvas = document.createElement("canvas");
canvas.width = 1200;
canvas.height = 700;
root.appendChild(canvas);

const ctx = canvas.getContext("2d")!;

// =====  Connection to Nucleus (for control messages) =====
let sessionId = "local";
let instanceId = "preview_1";
let playerId = "";

const ws = new WebSocket("ws://localhost:3000");
ws.onopen = () => {
  ws.send(
    JSON.stringify(
      env(sessionId, instanceId, "system.hello", { requestedRole: "preview" })
    )
  );
};

ws.onmessage = (evt) => {
  const parsed = (() => {
    try { return JSON.parse(String(evt.data)); } catch { return null; }
  })();
  const checked = EnvelopeSchema.safeParse(parsed);
  if (!checked.success) return;

  const e = checked.data;
  if (e.type === "system.welcome") {
    const wel = e as BusEnvelope<"system.welcome", MessageMap["system.welcome"]>;
    sessionId = wel.sessionId;
    instanceId = wel.payload.assignedInstanceId;
    hud.innerHTML = `<div style="color: #0f0">preview ✅ ${instanceId}</div>`;
  }
};

// ===== Connection to Sim Server (for gameplay) =====
let simConnected = false;
let prediction: PredictionEngine | null = null;
let currentMove = { x: 0, y: 0 };
let inputFrameCounter = 0;
let staticColliders: BoxCollider[] = [];
let lastCollisions = 0;

const simWs = new WebSocket("ws://localhost:4010");

simWs.onopen = () => {
  simConnected = true;
  playerId = `player_${sessionId}`;
  // Don't initialize prediction yet, wait for world metadata
  hud.innerHTML += `<div style="color: #3b82f6">sim connected ✅</div>`;
};

simWs.onmessage = (evt) => {
  const parsed = (() => {
    try { return JSON.parse(String(evt.data)); } catch { return null; }
  })();

  if (!parsed) return;
  const msg = parsed as SimMessage;

  if (msg.type === "sim.worldMetadata") {
    // Initialize prediction engine with world colliders
    const metadata = msg as SimWorldMetadata;
    staticColliders = metadata.payload.staticColliders || [];
    if (!prediction) {
      prediction = new PredictionEngine(playerId, staticColliders);
    }
    hud.innerHTML += `<div style="color: #8b5cf6">level loaded: ${metadata.payload.levelId}</div>`;
  } else if (msg.type === "sim.snapshot") {
    if (!prediction) return;

    // Receive authoritative snapshot and reconcile
    const snapshot = msg as SimSnapshot;
    prediction.reconcile({
      tick: snapshot.payload.tick,
      entities: snapshot.payload.entities.map((e: SimEntity) => ({
        id: e.id,
        pos: { x: e.pos.x, y: e.pos.y },
        vel: { x: e.vel.x, y: e.vel.y },
        collider: { radius: 15 }
      }))
    });

    // Track collisions
    lastCollisions = prediction.getLastCollisions().length;
  } else if (msg.type === "sim.inputAck") {
    // Server acked our input
  }
};

simWs.onclose = () => {
  simConnected = false;
  hud.innerHTML = hud.innerHTML.replace(/sim connected.*/g, "sim disconnected ❌");
};

// ===== Input Handling =====
const keysPressed: Record<string, boolean> = {};

document.addEventListener("keydown", (ev) => {
  keysPressed[ev.key.toLowerCase()] = true;
  updateInputFromKeys();
});

document.addEventListener("keyup", (ev) => {
  keysPressed[ev.key.toLowerCase()] = false;
  updateInputFromKeys();
});

function updateInputFromKeys() {
  const nextMove = { x: 0, y: 0 };
  if (keysPressed["w"] || keysPressed["arrowup"]) nextMove.y -= 1;
  if (keysPressed["s"] || keysPressed["arrowdown"]) nextMove.y += 1;
  if (keysPressed["a"] || keysPressed["arrowleft"]) nextMove.x -= 1;
  if (keysPressed["d"] || keysPressed["arrowright"]) nextMove.x += 1;

  // Normalize if diagonal
  if (nextMove.x !== 0 && nextMove.y !== 0) {
    nextMove.x *= 0.707;
    nextMove.y *= 0.707;
  }

  currentMove = nextMove;
}

// ===== Rendering Loop =====
let last = performance.now();
let acc = 0;
let frames = 0;
let fps = 0;

function draw(t: number) {
  const dt = (t - last) / 1000;
  last = t;

  frames++;
  acc += dt;

  // ===== Update Prediction =====
  if (prediction) {
    // Send input every 2 frames (~16ms @ 60fps) to avoid spam
    inputFrameCounter++;
    if (inputFrameCounter >= 2) {
      inputFrameCounter = 0;
      const inputSeq = prediction.predictInput(currentMove);

      // Send to sim server
      if (simConnected && simWs.readyState === WebSocket.OPEN) {
        simWs.send(
          JSON.stringify({
            meta: { v: "1.0.0", ts: Date.now() },
            type: "sim.input",
            payload: {
              playerId,
              inputSeq,
              clientTime: Date.now(),
              move: currentMove,
              actions: {}
            }
          })
        );
      }
    }

    // Step prediction forward with collision detection
    prediction.stepPrediction(dt);
  }

  // ===== Render =====
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid background
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw static collision boxes (world geometry)
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.3;
  for (const box of staticColliders) {
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = "rgba(124, 58, 237, 0.1)";
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
  ctx.globalAlpha = 1;

  // Draw entities
  if (prediction) {
    const visualState = prediction.getVisualState();
    for (const entity of visualState.entities.values()) {
      const isOwn = entity.id === playerId;
      const radius = 15;

      // Draw entity
      ctx.beginPath();
      ctx.arc(entity.pos.x, entity.pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isOwn ? "#10b981" : "#3b82f6";
      ctx.fill();

      if (isOwn) {
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw velocity vector
        ctx.beginPath();
        ctx.moveTo(entity.pos.x, entity.pos.y);
        const velLen = Math.sqrt(entity.vel.x ** 2 + entity.vel.y ** 2);
        if (velLen > 0) {
          ctx.lineTo(
            entity.pos.x + (entity.vel.x / velLen) * 30,
            entity.pos.y + (entity.vel.y / velLen) * 30
          );
        }
        ctx.stroke();

        // Draw collision radius outline
        ctx.strokeStyle = lastCollisions > 0 ? "#ef4444" : "rgba(52, 211, 153, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(entity.pos.x, entity.pos.y, radius + 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = isOwn ? "#10b981" : "#60a5fa";
      ctx.font = "11px monospace";
      ctx.fillText(entity.id.substring(0, 8), entity.pos.x + 20, entity.pos.y);
      ctx.fillText(
        `${Math.round(entity.vel.x)},${Math.round(entity.vel.y)}`,
        entity.pos.x + 20,
        entity.pos.y + 12
      );
    }
  }

  // HUD
  if (acc >= 0.5) {
    fps = Math.round(frames / acc);
    frames = 0;
    acc = 0;

    // Send stats to nucleus
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify(
          env(sessionId, instanceId, "preview.stats", {
            fps,
            frameMs: Math.round(dt * 1000 * 10) / 10
          })
        )
      );
    }
  }

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "14px monospace";
  ctx.fillText(`FPS: ${fps}`, 10, 25);
  ctx.fillText(`Connected: ${simConnected ? "✅" : "❌"}`, 10, 45);
  ctx.fillText(`Input: [${currentMove.x.toFixed(1)}, ${currentMove.y.toFixed(1)}]`, 10, 65);
  ctx.fillText(`Entities: ${prediction?.getVisualState().entities.size ?? 0}`, 10, 85);
  if (lastCollisions > 0) {
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`❗ Collisions: ${lastCollisions}`, 10, 105);
  }
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(`[WASD/Arrows] to move`, 10, canvas.height - 10);

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
