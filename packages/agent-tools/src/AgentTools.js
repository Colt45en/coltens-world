/**
 * AgentTools – LLM-style tool-call registry for agents.
 *
 * Tools have a JSON-Schema input spec so they can be serialised to any LLM
 * that supports function/tool calling.  Execution is synchronous or async and
 * always returns a plain JSON-serialisable result.
 */

/** @typedef {{ name:string, description:string, parameters: object, execute: Function }} ToolDef */

export class AgentToolRegistry {
  constructor() {
    /** @type {Map<string, ToolDef>} */
    this._tools = new Map();
  }

  /**
   * Register a tool.
   * @param {ToolDef} def
   */
  register(def) {
    if (!def.name)       throw new Error('Tool must have a name');
    if (!def.execute)    throw new Error('Tool must have an execute function');
    this._tools.set(def.name, def);
  }

  /** Unregister a tool by name. */
  unregister(name) {
    this._tools.delete(name);
  }

  /**
   * Call a tool by name with arguments.
   * @param {string} name
   * @param {object} args
   * @returns {Promise<any>}
   */
  async call(name, args = {}) {
    const tool = this._tools.get(name);
    if (!tool) throw new Error(`Unknown tool: '${name}'`);
    return await tool.execute(args);
  }

  /**
   * Return the full tool manifest (suitable for sending to an LLM).
   * @returns {Array<{name:string, description:string, parameters:object}>}
   */
  manifest() {
    return [...this._tools.values()].map(({ name, description, parameters }) => ({
      name,
      description: description ?? '',
      parameters: parameters ?? { type: 'object', properties: {} },
    }));
  }

  /** List all registered tool names. */
  get names() {
    return [...this._tools.keys()];
  }
}

// ── Built-in world tools ───────────────────────────────────────────────────

/**
 * Register a standard set of world-interaction tools onto a registry.
 * @param {AgentToolRegistry} registry
 * @param {import('../../world-engine/src/WorldEngine.js').WorldEngine} world
 */
export function registerWorldTools(registry, world) {
  registry.register({
    name: 'world.snapshot',
    description: 'Return the current world state snapshot.',
    parameters: { type: 'object', properties: {} },
    execute: () => world.snapshot(),
  });

  registry.register({
    name: 'world.spawnEntity',
    description: 'Spawn a new entity in the world.',
    parameters: {
      type: 'object',
      required: ['id'],
      properties: {
        id:         { type: 'string', description: 'Unique entity id' },
        components: { type: 'object', description: 'Initial component values' },
      },
    },
    execute: ({ id, components = {} }) => world.spawn(id, components),
  });

  registry.register({
    name: 'world.despawnEntity',
    description: 'Remove an entity from the world.',
    parameters: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    execute: ({ id }) => { world.despawn(id); return { despawned: id }; },
  });

  registry.register({
    name: 'world.setComponent',
    description: 'Set a component value on an entity.',
    parameters: {
      type: 'object',
      required: ['entityId', 'componentName', 'data'],
      properties: {
        entityId:      { type: 'string' },
        componentName: { type: 'string' },
        data:          { type: 'object' },
      },
    },
    execute: ({ entityId, componentName, data }) => {
      world.setComponent(entityId, componentName, data);
      return { entityId, componentName, data };
    },
  });

  registry.register({
    name: 'world.getComponent',
    description: 'Read a component value from an entity.',
    parameters: {
      type: 'object',
      required: ['entityId', 'componentName'],
      properties: {
        entityId:      { type: 'string' },
        componentName: { type: 'string' },
      },
    },
    execute: ({ entityId, componentName }) =>
      world.getComponent(entityId, componentName) ?? null,
  });
}
