/**
 * Bus system for inter-module communication
 */

/**
 * Bus system for inter-module communication
 */
import type { BusEnvelope } from "@world-engine/protocol";

declare const crypto: { randomUUID: () => string };
declare const console: { error: (..._args: unknown[]) => void };

/**
 * Bus contracts
 * These are intentionally minimal and unopinionated, to allow flexibility in implementation.
 * Validation, permissions, and other policies should be implemented in the Router or higher-level abstractions.
 */
export type MessageHandler<T = unknown> = (_message: T, _envelope: BusEnvelope<string, T>) => void | Promise<void>;
export type RequestHandler<Req = unknown, Res = unknown> = (_request: Req, _envelope: BusEnvelope<string, Req>) => Promise<Res>;

/**
 * Channel container: groups related messages
 */
export interface Channel {
  name: string;
  subscribe: (_type: string, _handler: MessageHandler) => () => void;
  publish: (_type: string, _payload: unknown, _from: { role: string; instanceId: string }, _sessionId: string) => void;
  request: (_type: string, _payload: unknown, _from: { role: string; instanceId: string }, _sessionId: string, _timeout?: number) => Promise<unknown>;
  onRequest: (_type: string, _handler: RequestHandler) => () => void;
}

/**
 * Router: enforces permissions and message validation
 */
export interface Router {
  register(_messageType: string, _handler: MessageHandler, _requiredCaps?: string[]): void;
  handle(_envelope: BusEnvelope<string, any>, _sessionCaps: string[]): Promise<void>;
}

/**
 * Bus interface: multiplex channels
 */
export interface Bus {
  system: Channel;
  files: Channel;
  build: Channel;
  runtime: Channel;
  graphics: Channel;
  lexicon: Channel;
  math: Channel;
  ai: Channel;

  subscribe<T>(_channel: string, _type: string, _handler: MessageHandler<T>): () => void;
  publish<T>(_channel: string, _type: string, _payload: T, _from: { role: string; instanceId: string }, _sessionId: string): void;
  request<Req, Res>(_channel: string, _type: string, _payload: Req, _from: { role: string; instanceId: string }, _sessionId: string, _timeout?: number): Promise<Res>;
  onRequest<Req, Res>(_channel: string, _type: string, _handler: RequestHandler<Req, Res>): () => void;
}

/**
 * In-memory implementation of Bus
 */
export class LocalBus implements Bus {
  system: Channel;
  files: Channel;
  build: Channel;
  runtime: Channel;
  graphics: Channel;
  lexicon: Channel;
  math: Channel;
  ai: Channel;

  private readonly channels: Map<string, ChannelImpl> = new Map();
  private readonly handlers: Map<string, Set<MessageHandler>> = new Map();
  private readonly requestHandlers: Map<string, Set<RequestHandler>> = new Map();
  private readonly pendingRequests: Map<string, { resolve: (_v: unknown) => void; reject: (_e: Error) => void; timeout: unknown }> = new Map();

  constructor() {
    this.system = this.createChannel('system');
    this.files = this.createChannel('files');
    this.build = this.createChannel('build');
    this.runtime = this.createChannel('runtime');
    this.graphics = this.createChannel('graphics');
    this.lexicon = this.createChannel('lexicon');
    this.math = this.createChannel('math');
    this.ai = this.createChannel('ai');
  }

  private createChannel(name: string): Channel {
    return new ChannelImpl(name, this.handlers, this.requestHandlers, this.pendingRequests);
  }

  subscribe<T>(channel: string, type: string, handler: MessageHandler<T>): () => void {
    const key = `${channel}:${type}`;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler as MessageHandler);
    return () => this.handlers.get(key)?.delete(handler as MessageHandler);
  }

  publish<T>(channel: string, type: string, payload: T, from: { role: string; instanceId: string }, sessionId: string): void {
    const key = `${channel}:${type}`;
    const handlers = this.handlers.get(key);
    if (!handlers) return;

    const envelope = {
      v: 1,
      id: crypto.randomUUID(),
      type,
      ts: Date.now(),
      from,
      sessionId,
      payload,
    };

    handlers.forEach(handler => {
      try {
        handler(payload, envelope as any);
      } catch (e) {
        console.error(`Error in handler for ${key}:`, e);
      }
    });
  }

  async request<Req, Res>(channel: string, type: string, payload: Req, from: { role: string; instanceId: string }, sessionId: string, _timeout: number = 5000): Promise<Res> {
    const key = `${channel}:${type}`;
    const handlers = this.requestHandlers.get(key);
    if (!handlers || handlers.size === 0) {
      throw new Error(`No request handler for ${key}`);
    }

    const handler = handlers.values().next().value;
    if (!handler) {
      throw new Error(`No request handler for ${key}`);
    }

    const envelope = {
      v: 1,
      id: crypto.randomUUID(),
      type,
      ts: Date.now(),
      from,
      sessionId,
      payload,
    };

    return handler(payload, envelope as any) as Promise<Res>;
  }

  onRequest<Req, Res>(channel: string, type: string, handler: RequestHandler<Req, Res>): () => void {
    const key = `${channel}:${type}`;
    if (!this.requestHandlers.has(key)) {
      this.requestHandlers.set(key, new Set());
    }
    this.requestHandlers.get(key)!.add(handler as RequestHandler);
    return () => this.requestHandlers.get(key)?.delete(handler as RequestHandler);
  }
}

class ChannelImpl implements Channel {
  constructor(
    readonly _name: string,
    private readonly _handlers: Map<string, Set<MessageHandler>>,
    private readonly _requestHandlers: Map<string, Set<RequestHandler>>,
    private readonly _pendingRequests: Map<string, { resolve: (_v: unknown) => void; reject: (_e: Error) => void; timeout: unknown }>,
  ) { }

  get name(): string {
    return this._name;
  }

  subscribe(type: string, handler: MessageHandler): () => void {
    const key = `${this.name}:${type}`;
    if (!this._handlers.has(key)) {
      this._handlers.set(key, new Set());
    }
    this._handlers.get(key)!.add(handler);
    return () => this._handlers.get(key)?.delete(handler);
  }

  publish(type: string, payload: unknown, from: { role: string; instanceId: string }, sessionId: string): void {
    const key = `${this.name}:${type}`;
    const handlers = this._handlers.get(key);
    if (!handlers) return;

    const envelope = {
      v: 1,
      id: crypto.randomUUID(),
      type,
      ts: Date.now(),
      from,
      sessionId,
      payload,
    };

    handlers.forEach(handler => {
      try {
        handler(payload, envelope as any);
      } catch (e) {
        console.error(`Error in handler for ${key}:`, e);
      }
    });
  }

  async request(type: string, payload: unknown, from: { role: string; instanceId: string }, sessionId: string, _timeout: number = 5000): Promise<unknown> {
    const key = `${this.name}:${type}`;
    const handlers = this._requestHandlers.get(key);
    if (!handlers || handlers.size === 0) {
      throw new Error(`No request handler for ${key}`);
    }

    const handler = handlers.values().next().value;
    if (!handler) {
      throw new Error(`No request handler for ${key}`);
    }

    const envelope = {
      v: 1,
      id: crypto.randomUUID(),
      type,
      ts: Date.now(),
      from,
      sessionId,
      payload,
    };

    return handler(payload, envelope as any);
  }

  onRequest(type: string, handler: RequestHandler): () => void {
    const key = `${this.name}:${type}`;
    if (!this._requestHandlers.has(key)) {
      this._requestHandlers.set(key, new Set());
    }
    this._requestHandlers.get(key)!.add(handler);
    return () => this._requestHandlers.get(key)?.delete(handler);
  }
}
