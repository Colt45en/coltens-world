/**
 * MessageBus – deterministic, synchronous, typed event hub.
 *
 * All inter-module communication MUST go through this bus so that
 * the full message log can be replayed to reproduce any world state.
 */
export class MessageBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {Array<{tick:number, topic:string, payload:any}>} */
    this._log = [];
    this._tick = 0;
  }

  /** Advance the logical tick counter. Called once per world tick. */
  advanceTick() {
    this._tick += 1;
  }

  /** Current logical tick. */
  get tick() {
    return this._tick;
  }

  /**
   * Subscribe to a topic.
   * @param {string} topic
   * @param {Function} handler  fn(payload, tick) => void
   * @returns {() => void} unsubscribe function
   */
  on(topic, handler) {
    if (!this._listeners.has(topic)) this._listeners.set(topic, new Set());
    this._listeners.get(topic).add(handler);
    return () => this._listeners.get(topic).delete(handler);
  }

  /**
   * Publish a message.
   * @param {string} topic
   * @param {any}    payload
   */
  emit(topic, payload) {
    const entry = { tick: this._tick, topic, payload };
    this._log.push(entry);
    const handlers = this._listeners.get(topic);
    if (handlers) {
      for (const h of handlers) h(payload, this._tick);
    }
  }

  /** Full immutable message log (for replay / debugging). */
  get log() {
    return Object.freeze([...this._log]);
  }

  /** Reset bus state (clears log + subscriptions + tick). */
  reset() {
    this._listeners.clear();
    this._log.length = 0;
    this._tick = 0;
  }
}

export const bus = new MessageBus();
