import { SimInbound, type SimInputT } from "@world-engine/engine";
import { WebSocket, WebSocketServer } from "ws";
import { validateMoveAgainstColliders, type BoxCollider } from "../sim/collision";
import { toSnapshot } from "../sim/snapshot";
import { DefaultTickConfig, stepVelocity } from "../sim/tick";
import { validateMove } from "../sim/validate";
import { ensurePlayer, type World } from "../sim/world";

type Client = { ws: WebSocket; playerId: string | null; lastInputSeq: number };

export function startSimWsServer(opts: {
  port: number;
  world: World;
  staticColliders?: BoxCollider[];
}) {
  const wss = new WebSocketServer({ port: opts.port });
  const clients = new Set<Client>();
  let lastProcessedInputSeq = 0; // Global input seq tracker
  const staticColliders = opts.staticColliders ?? [];

  function broadcast(msg: unknown) {
    const data = JSON.stringify(msg);
    for (const c of clients) {
      if (c.ws.readyState === c.ws.OPEN) c.ws.send(data);
    }
  }

  wss.on("connection", (ws: WebSocket) => {
    const client: Client = { ws, playerId: null, lastInputSeq: 0 };
    clients.add(client);

    // Send world metadata on connection
    ws.send(
      JSON.stringify({
        meta: {
          v: "1.0.0",
          ts: Date.now(),
          source: "sim-server",
        },
        type: "sim.worldMetadata",
        payload: {
          levelId: "v1-arena",
          staticColliders,
        },
      })
    );

    ws.on("close", () => clients.delete(client));

    ws.on("message", (buf: { toString: (_encoding: string) => string; }) => {
      let raw: unknown;
      try {
        raw = JSON.parse(buf.toString("utf8"));
      } catch {
        return;
      }

      const parsed = SimInbound.safeParse(raw);
      if (!parsed.success) return;

      const msg = parsed.data as SimInputT;
      const { playerId, inputSeq } = msg.payload;
      client.playerId = playerId;
      client.lastInputSeq = inputSeq;
      lastProcessedInputSeq = Math.max(lastProcessedInputSeq, inputSeq);

      const e = ensurePlayer(opts.world, playerId);
      const mv = validateMove(msg.payload.move);

      // Apply input -> target velocity
      const cfg = DefaultTickConfig;
      const targetVx = mv.x * cfg.maxSpeed;
      const targetVz = mv.y * cfg.maxSpeed;

      e.vel.x = stepVelocity(e.vel.x, targetVx, cfg.accel, cfg.dt);
      e.vel.z = stepVelocity(e.vel.z, targetVz, cfg.accel, cfg.dt);

      // Ack for reconciliation later
      ws.send(
        JSON.stringify({
          meta: {
            v: "1.0.0",
            ts: Date.now(),
            requestId: msg.meta.requestId,
            source: "sim-server",
          },
          type: "sim.inputAck",
          payload: { playerId, inputSeq, tickApplied: opts.world.tick },
        })
      );
    });
  });

  // Tick loop
  const cfg = DefaultTickConfig;
  const interval = setInterval(() => {
    // integrate positions with collision validation
    for (const e of opts.world.entities.values()) {
      const nextPos = {
        x: e.pos.x + e.vel.x * cfg.dt,
        y: e.pos.y + e.vel.y * cfg.dt,
        z: e.pos.z, // z is ignored in 2D collision
      };

      // Validate move against static colliders
      const validPos = validateMoveAgainstColliders(e.pos, nextPos, staticColliders);
      e.pos = validPos;
    }
    opts.world.tick += 1;

    // snapshot broadcast (v1 full snapshot with inputSeq for reconciliation)
    const snapshot = toSnapshot(opts.world);
    broadcast({
      meta: { v: "1.0.0", ts: Date.now(), source: "sim-server" },
      type: "sim.snapshot",
      payload: {
        ...snapshot,
        lastProcessedInputSeq,
      },
    });
  }, Math.round(cfg.dt * 1000));

  return {
    close() {
      clearInterval(interval);
      wss.close();
      for (const c of clients) {
        try {
          c.ws.close();
        } catch {
          // ignore
        }
      }
      clients.clear();
    },
  };
}
