/**
 * World Engine – deterministic ECS (Entity-Component-System) with a fixed-step
 * tick loop.  All mutations are funnelled through the MessageBus so the full
 * world state is replayable.
 */

/** @typedef {{ id:string, components: Map<string,any> }} Entity */

export class WorldEngine {
  /**
   * @param {import('../../bus/src/MessageBus.js').MessageBus} bus
   * @param {{ tickRateHz?: number }} [opts]
   */
  constructor(bus, opts = {}) {
    this.bus = bus;
    this._tickRateHz = opts.tickRateHz ?? 20;
    this._tickIntervalMs = 1000 / this._tickRateHz;

    /** @type {Map<string, Entity>} */
    this._entities = new Map();
    /** @type {Map<string, Function>} system name → update(entities, dt) */
    this._systems = new Map();

    this._running = false;
    this._lastTime = 0;
    this._timerId = null;
  }

  // ── Entity API ──────────────────────────────────────────────────────────────

  /**
   * Spawn a new entity.
   * @param {string} id
   * @param {Record<string,any>} [components]
   * @returns {Entity}
   */
  spawn(id, components = {}) {
    if (this._entities.has(id)) throw new Error(`Entity '${id}' already exists`);
    const entity = { id, components: new Map(Object.entries(components)) };
    this._entities.set(id, entity);
    this.bus.emit('world:entity:spawned', { id, components });
    return entity;
  }

  /**
   * Destroy an entity.
   * @param {string} id
   */
  despawn(id) {
    if (!this._entities.has(id)) return;
    this._entities.delete(id);
    this.bus.emit('world:entity:despawned', { id });
  }

  /**
   * Get entity by id.
   * @param {string} id
   * @returns {Entity|undefined}
   */
  getEntity(id) {
    return this._entities.get(id);
  }

  /** Return all entities as an array. */
  get entities() {
    return [...this._entities.values()];
  }

  /**
   * Add or update a component on an entity.
   * @param {string} entityId
   * @param {string} componentName
   * @param {any}    data
   */
  setComponent(entityId, componentName, data) {
    const e = this._entities.get(entityId);
    if (!e) throw new Error(`Entity '${entityId}' not found`);
    e.components.set(componentName, data);
    this.bus.emit('world:component:set', { entityId, componentName, data });
  }

  /**
   * Read a component from an entity.
   * @param {string} entityId
   * @param {string} componentName
   */
  getComponent(entityId, componentName) {
    return this._entities.get(entityId)?.components.get(componentName);
  }

  // ── System API ──────────────────────────────────────────────────────────────

  /**
   * Register a system.
   * @param {string}   name
   * @param {Function} updateFn  (entities: Entity[], dt: number) => void
   */
  registerSystem(name, updateFn) {
    this._systems.set(name, updateFn);
  }

  /** Remove a registered system. */
  removeSystem(name) {
    this._systems.delete(name);
  }

  // ── Tick loop ───────────────────────────────────────────────────────────────

  /**
   * Manually execute one tick (useful for deterministic replay / tests).
   * @param {number} [dt]  delta-time in seconds; defaults to 1/tickRateHz
   */
  tick(dt) {
    const delta = dt ?? 1 / this._tickRateHz;
    const entities = this.entities;
    for (const system of this._systems.values()) {
      system(entities, delta);
    }
    this.bus.advanceTick();
    this.bus.emit('world:tick', { tick: this.bus.tick, dt: delta });
  }

  /** Start the real-time tick loop. */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = Date.now();
    const loop = () => {
      if (!this._running) return;
      const now = Date.now();
      const dt = (now - this._lastTime) / 1000;
      this._lastTime = now;
      this.tick(dt);
      this._timerId = setTimeout(loop, this._tickIntervalMs);
    };
    this._timerId = setTimeout(loop, this._tickIntervalMs);
    this.bus.emit('world:started', {});
  }

  /** Stop the real-time tick loop. */
  stop() {
    this._running = false;
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
    this.bus.emit('world:stopped', {});
  }

  /** Snapshot the full world state as a plain JSON-serialisable object. */
  snapshot() {
    const entities = {};
    for (const [id, e] of this._entities) {
      entities[id] = Object.fromEntries(e.components);
    }
    return { tick: this.bus.tick, entities };
  }
}
