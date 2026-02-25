/**
 * Brain Nucleus – lightweight agent decision system.
 *
 * Each Brain is composed of:
 *   • Sensors  – read world state into a perception object
 *   • Planner  – pick an action given perception + memory
 *   • Memory   – short-term key/value store
 *
 * Brains are ticked by the world engine via the MessageBus.
 */

export class Brain {
  /**
   * @param {string} agentId
   * @param {import('../../bus/src/MessageBus.js').MessageBus} bus
   */
  constructor(agentId, bus) {
    this.agentId = agentId;
    this.bus = bus;

    /** @type {Map<string, any>} */
    this.memory = new Map();

    /** @type {Array<(perception: object, memory: Map<string,any>) => string|null>} */
    this._planners = [];

    /** @type {Map<string, (bus: any, agentId: string, memory: Map<string,any>) => void>} */
    this._actions = new Map();

    /** @type {Array<(worldSnapshot: object) => object>} */
    this._sensors = [];

    /** Internal: latest perception built from sensors. */
    this._perception = {};

    this.bus.on('world:tick', ({ tick }) => this._onTick(tick));
  }

  // ── Sensor API ──────────────────────────────────────────────────────────────

  /**
   * Add a sensor function.
   * @param {Function} sensorFn  (worldSnapshot: object) => partialPerception: object
   */
  addSensor(sensorFn) {
    this._sensors.push(sensorFn);
  }

  // ── Planner API ─────────────────────────────────────────────────────────────

  /**
   * Add a planner function.  The first planner to return a non-null action name wins.
   * @param {Function} plannerFn  (perception, memory) => actionName | null
   */
  addPlanner(plannerFn) {
    this._planners.push(plannerFn);
  }

  // ── Action API ──────────────────────────────────────────────────────────────

  /**
   * Register an action handler.
   * @param {string}   name
   * @param {Function} actionFn  (bus, agentId, memory) => void
   */
  registerAction(name, actionFn) {
    this._actions.set(name, actionFn);
  }

  // ── Memory helpers ──────────────────────────────────────────────────────────

  remember(key, value) { this.memory.set(key, value); }
  recall(key)          { return this.memory.get(key); }
  forget(key)          { this.memory.delete(key); }

  // ── Internal ────────────────────────────────────────────────────────────────

  _onTick(tick) {
    // 1. Sense
    this._perception = {};
    for (const sensor of this._sensors) {
      Object.assign(this._perception, sensor(this._perception));
    }
    this._perception.tick = tick;

    // 2. Plan
    let chosen = null;
    for (const planner of this._planners) {
      chosen = planner(this._perception, this.memory);
      if (chosen !== null && chosen !== undefined) break;
    }

    // 3. Act
    if (chosen && this._actions.has(chosen)) {
      this._actions.get(chosen)(this.bus, this.agentId, this.memory);
      this.bus.emit('brain:action', { agentId: this.agentId, action: chosen, tick });
    }
  }
}

// ── BrainNucleus registry ──────────────────────────────────────────────────

export class BrainNucleus {
  /**
   * @param {import('../../bus/src/MessageBus.js').MessageBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    /** @type {Map<string, Brain>} */
    this._brains = new Map();
  }

  /**
   * Create and register a brain for an agent.
   * @param {string} agentId
   * @returns {Brain}
   */
  createBrain(agentId) {
    if (this._brains.has(agentId)) throw new Error(`Brain for '${agentId}' already exists`);
    const brain = new Brain(agentId, this.bus);
    this._brains.set(agentId, brain);
    return brain;
  }

  /**
   * Get the brain for an agent.
   * @param {string} agentId
   * @returns {Brain|undefined}
   */
  getBrain(agentId) {
    return this._brains.get(agentId);
  }

  /** Remove and destroy the brain for an agent. */
  removeBrain(agentId) {
    this._brains.delete(agentId);
  }

  /** All registered agent IDs. */
  get agentIds() {
    return [...this._brains.keys()];
  }
}
