import type { BusEnvelope, MessageMap } from "@world-engine/protocol";
import { EnvelopeSchema } from "@world-engine/protocol";
import { makeEnv, type AnyEnv } from "./protocol";

type FromIde = { role: "ide"; instanceId: string };

export type Handlers = {
  onWelcome: (env: BusEnvelope<"system.welcome", MessageMap["system.welcome"]>) => void;

  onPtyOpened: (env: BusEnvelope<"pty.opened", MessageMap["pty.opened"]>) => void;
  onPtyOutput: (env: BusEnvelope<"pty.output", MessageMap["pty.output"]>) => void;
  onPreviewStats: (env: BusEnvelope<"preview.stats", MessageMap["preview.stats"]>) => void;
  onFilesChanged: (env: BusEnvelope<"files.changed", MessageMap["files.changed"]>) => void;

  onSimStart: (env: BusEnvelope<"sim.start", MessageMap["sim.start"]>) => void;
  onSimLog: (env: BusEnvelope<"sim.log", MessageMap["sim.log"]>) => void;
  onSimDone: (env: BusEnvelope<"sim.done", MessageMap["sim.done"]>) => void;

  onIdeCliRunResponse?: (
    env: BusEnvelope<"ide.cli.run.response", MessageMap["ide.cli.run.response"]>
  ) => void;
  onIdeFsReadResponse?: (
    env: BusEnvelope<"ide.fs.read.response", MessageMap["ide.fs.read.response"]>
  ) => void;

  onBrainChatDelta?: (
    env: BusEnvelope<"brain.chat.delta", MessageMap["brain.chat.delta"]>
  ) => void;
  onBrainChatDone?: (
    env: BusEnvelope<"brain.chat.done", MessageMap["brain.chat.done"]>
  ) => void;
  onBrainChatError?: (
    env: BusEnvelope<"brain.chat.error", MessageMap["brain.chat.error"]>
  ) => void;

  /** Optional lifecycle hooks for status banner */
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
  onReconnectAttempt?: (attempt: number, delayMs: number) => void;
  onReconnectSuccess?: () => void;
};

export type WsClientOptions = {
  sessionId?: string;
  instanceId?: string;

  /** Reconnect policy */
  reconnect?: boolean;
  reconnectMaxDelayMs?: number; // cap
  reconnectBaseDelayMs?: number; // base
  reconnectJitterMs?: number; // +/- jitter

  /** Keep-alive */
  pingIntervalMs?: number; // 0 disables

  /** Handshake */
  handshakeTimeoutMs?: number;
};

type Outbound = { type: keyof MessageMap; payload: MessageMap[keyof MessageMap] };

export class WsClient {
  private readonly url: string;
  private readonly handlers: Handlers;
  private readonly opts: Required<WsClientOptions>;

  private ws: WebSocket | null = null;

  private sessionId: string;
  private instanceId: string;
  private token = "";

  private isWelcomed = false;
  private isManuallyClosed = false;

  private outboundQueue: Outbound[] = [];

  private reconnectAttempt = 0;
  private pingTimer: any = null;
  private reconnectTimer: any = null;
  private handshakeTimer: any = null;
  private connectEpoch = 0;
  private hasConnectedBefore = false;
  private nextClientSeq = 1;

  constructor(url: string, handlers: Handlers, options: WsClientOptions = {}) {
    if (/\/ws\/bus(?:\/|$)/.test(url)) {
      throw new Error(
        "WsClient must connect to Nucleus hub endpoint (ws://localhost:3000), not /ws/bus"
      );
    }

    this.url = url;
    this.handlers = handlers;

    this.opts = {
      sessionId: options.sessionId ?? "local",
      instanceId: options.instanceId ?? "ide_1",

      reconnect: options.reconnect ?? true,
      reconnectMaxDelayMs: options.reconnectMaxDelayMs ?? 15_000,
      reconnectBaseDelayMs: options.reconnectBaseDelayMs ?? 300,
      reconnectJitterMs: options.reconnectJitterMs ?? 250,

      pingIntervalMs: options.pingIntervalMs ?? 20_000,
      handshakeTimeoutMs: options.handshakeTimeoutMs ?? 5_000,
    };

    this.sessionId = this.opts.sessionId;
    this.instanceId = this.opts.instanceId;

    this.connect();
  }

  /** Public API */
  close(code = 1000, reason = "client_close") {
    this.isManuallyClosed = true;
    this.stopPing();
    this.stopHandshakeTimeout();
    this.clearReconnectTimer();
    this.ws?.close(code, reason);
  }

  /** Ready = welcomed + socket open */
  isReady(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN && this.isWelcomed;
  }

  /** Send typed env. Queues until welcome. */
  send<T extends keyof MessageMap>(type: T, payload: MessageMap[T]): void {
    if (this.ws?.readyState !== WebSocket.OPEN || !this.isWelcomed) {
      this.outboundQueue.push({ type, payload } as Outbound);
      return;
    }

    const env = makeEnv(
      this.sessionId,
      { role: "ide", instanceId: this.instanceId },
      type,
      payload,
      this.token
    );

    ((env as unknown) as AnyEnv & { client_seq: number }).client_seq = this.nextClientSeq++;

    this.ws.send(JSON.stringify(env));
  }

  // -------------------- Internals --------------------

  private connect() {
    this.isManuallyClosed = false;
    this.isWelcomed = false;
    this.stopHandshakeTimeout();

    const ws = new WebSocket(this.url);
    this.ws = ws;
    const epoch = ++this.connectEpoch;

    ws.onopen = () => {
      if (this.ws !== ws || epoch !== this.connectEpoch) return;

      this.handlers.onOpen?.();

      // Handshake without auth (allowed by wsHub middleware)
      ws.send(
        JSON.stringify({
          v: 2,
          id: this.randomId("hello"),
          type: "system.hello",
          ts: Date.now(),
          from: { role: "ide", instanceId: this.instanceId },
          sessionId: this.sessionId,
          client_seq: this.nextClientSeq++,
          payload: { requestedRole: "ide" },
        })
      );

      this.startHandshakeTimeout(epoch);
      this.startPing();
    };

    ws.onmessage = (evt) => this.onMessage(evt);

    ws.onerror = (ev) => {
      if (this.ws !== ws || epoch !== this.connectEpoch) return;
      this.handlers.onError?.(ev);
      // onclose will follow in most implementations; reconnect logic is centralized there.
    };

    ws.onclose = (ev) => {
      if (this.ws !== ws || epoch !== this.connectEpoch) return;

      this.stopPing();
      this.stopHandshakeTimeout();
      this.handlers.onClose?.(ev);

      if (this.isManuallyClosed) return;
      if (!this.opts.reconnect) return;

      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectAttempt++;

    const base = this.opts.reconnectBaseDelayMs;
    const cap = this.opts.reconnectMaxDelayMs;
    const jitter = this.opts.reconnectJitterMs;

    // exponential backoff: base * 2^(attempt-1)
    const exp = base * Math.pow(2, Math.max(0, this.reconnectAttempt - 1));
    const clamped = Math.min(cap, exp);

    // jitter in [-jitter, +jitter]
    const j = (Math.random() * 2 - 1) * jitter;
    const delayMs = Math.max(0, Math.floor(clamped + j));

    this.handlers.onReconnectAttempt?.(this.reconnectAttempt, delayMs);

    this.reconnectTimer = globalThis.setTimeout(() => {
      if (this.isManuallyClosed) return;
      this.connect();
    }, delayMs);
  }

  private onMessage(evt: MessageEvent) {
    const raw = String(evt.data);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const checked = EnvelopeSchema.safeParse(parsed);
    if (!checked.success) return;

    const env = checked.data as AnyEnv;

    // Fast-path: welcome initializes session/token + flush queue
    if (env.type === "system.welcome") {
      const typed = env as BusEnvelope<"system.welcome", MessageMap["system.welcome"]>;
      this.sessionId = typed.sessionId;
      this.instanceId = typed.payload.assignedInstanceId;
      this.token = (typed.auth as any)?.token ?? "";

      this.stopHandshakeTimeout();
      this.isWelcomed = true;
      this.handlers.onWelcome(typed);

      if (this.hasConnectedBefore) {
        this.handlers.onReconnectSuccess?.();
      }
      this.hasConnectedBefore = true;
      this.reconnectAttempt = 0;

      this.flushQueue();
      return;
    }

    this.dispatch(env);
  }

  private flushQueue() {
    if (!this.isReady()) return;
    const pending = this.outboundQueue;
    this.outboundQueue = [];
    for (const item of pending) {
      // item is safe; makeEnv validates contract upstream.
      this.send(item.type as any, item.payload as any);
    }
  }

  private dispatch(env: AnyEnv) {
    // Dispatch table keeps this maintainable + avoids if/else ladder.
    const t = env.type as keyof MessageMap;

    switch (t) {
      case "pty.opened":
        this.handlers.onPtyOpened(env as any);
        return;
      case "pty.output":
        this.handlers.onPtyOutput(env as any);
        return;
      case "preview.stats":
        this.handlers.onPreviewStats(env as any);
        return;
      case "files.changed":
        this.handlers.onFilesChanged(env as any);
        return;

      case "sim.start":
        this.handlers.onSimStart(env as any);
        return;
      case "sim.log":
        this.handlers.onSimLog(env as any);
        return;
      case "sim.done":
        this.handlers.onSimDone(env as any);
        return;

      case "ide.cli.run.response":
        this.handlers.onIdeCliRunResponse?.(env as any);
        return;
      case "ide.fs.read.response":
        this.handlers.onIdeFsReadResponse?.(env as any);
        return;

      case "brain.chat.delta":
        this.handlers.onBrainChatDelta?.(env as any);
        return;
      case "brain.chat.done":
        this.handlers.onBrainChatDone?.(env as any);
        return;
      case "brain.chat.error":
        this.handlers.onBrainChatError?.(env as any);
        return;

      default:
        // Unknown/unused env types can be ignored safely.
        return;
    }
  }

  private startPing() {
    if (this.opts.pingIntervalMs <= 0) return;
    this.stopPing();

    this.pingTimer = globalThis.setInterval(() => {
      // If your server supports a ping message type, emit it here.
      // Otherwise a no-op is fine; some browsers/proxies still keep TCP alive with traffic.
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      // Optional: if you have a "system.ping" contract, use this.send("system.ping", {...})
      // For now, send a tiny frame that still validates as JSON? No — avoid invalid envelopes.
      // Best is to define a real contract later. Leaving ping silent prevents schema pollution.
    }, this.opts.pingIntervalMs);
  }

  private stopPing() {
    if (this.pingTimer != null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private startHandshakeTimeout(epoch: number) {
    if (this.opts.handshakeTimeoutMs <= 0) return;

    this.stopHandshakeTimeout();
    this.handshakeTimer = globalThis.setTimeout(() => {
      if (this.isWelcomed) return;
      if (epoch !== this.connectEpoch) return;
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      this.handlers.onError?.(new Event("ws_handshake_timeout"));
      this.ws.close(4000, "handshake timeout waiting for system.welcome");
    }, this.opts.handshakeTimeoutMs);
  }

  private stopHandshakeTimeout() {
    if (this.handshakeTimer != null) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private randomId(prefix: string): string {
    const r = Math.random().toString(16).slice(2);
    return `${prefix}_${Date.now().toString(16)}_${r}`;
  }
}
