import { AgentToolRegistry, registerWorldTools } from '../src/AgentTools.js';
import { MessageBus } from '../../bus/src/MessageBus.js';
import { WorldEngine } from '../../world-engine/src/WorldEngine.js';

function makeRegistry() {
  const bus    = new MessageBus();
  const world  = new WorldEngine(bus);
  const tools  = new AgentToolRegistry();
  registerWorldTools(tools, world);
  return { bus, world, tools };
}

describe('AgentToolRegistry', () => {
  test('register + names', () => {
    const tools = new AgentToolRegistry();
    tools.register({ name: 'greet', execute: () => 'hello' });
    expect(tools.names).toContain('greet');
  });

  test('unregister removes the tool', () => {
    const tools = new AgentToolRegistry();
    tools.register({ name: 'temp', execute: () => {} });
    tools.unregister('temp');
    expect(tools.names).not.toContain('temp');
  });

  test('call executes the tool', async () => {
    const tools = new AgentToolRegistry();
    tools.register({ name: 'add', execute: ({ a, b }) => a + b });
    expect(await tools.call('add', { a: 2, b: 3 })).toBe(5);
  });

  test('call throws for unknown tool', async () => {
    const tools = new AgentToolRegistry();
    await expect(tools.call('unknown')).rejects.toThrow("Unknown tool: 'unknown'");
  });

  test('register throws if name is missing', () => {
    const tools = new AgentToolRegistry();
    expect(() => tools.register({ execute: () => {} })).toThrow('Tool must have a name');
  });

  test('register throws if execute is missing', () => {
    const tools = new AgentToolRegistry();
    expect(() => tools.register({ name: 'bad' })).toThrow('Tool must have an execute function');
  });

  test('manifest returns name + description + parameters', () => {
    const tools = new AgentToolRegistry();
    tools.register({ name: 't1', description: 'desc', parameters: { type: 'object' }, execute: () => {} });
    const m = tools.manifest();
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ name: 't1', description: 'desc' });
  });
});

describe('World built-in tools', () => {
  test('world.snapshot returns tick and entities', async () => {
    const { tools } = makeRegistry();
    const snap = await tools.call('world.snapshot');
    expect(snap).toHaveProperty('tick');
    expect(snap).toHaveProperty('entities');
  });

  test('world.spawnEntity spawns into the world', async () => {
    const { tools, world } = makeRegistry();
    await tools.call('world.spawnEntity', { id: 'tool-entity', components: { hp: 50 } });
    expect(world.getEntity('tool-entity')).toBeDefined();
    expect(world.getComponent('tool-entity', 'hp')).toBe(50);
  });

  test('world.despawnEntity removes from the world', async () => {
    const { tools, world } = makeRegistry();
    world.spawn('bye');
    await tools.call('world.despawnEntity', { id: 'bye' });
    expect(world.getEntity('bye')).toBeUndefined();
  });

  test('world.setComponent and world.getComponent', async () => {
    const { tools, world } = makeRegistry();
    world.spawn('cmp-entity');
    await tools.call('world.setComponent', { entityId: 'cmp-entity', componentName: 'speed', data: { value: 10 } });
    const result = await tools.call('world.getComponent', { entityId: 'cmp-entity', componentName: 'speed' });
    expect(result).toEqual({ value: 10 });
  });

  test('world.getComponent returns null for missing component', async () => {
    const { tools, world } = makeRegistry();
    world.spawn('bare');
    const result = await tools.call('world.getComponent', { entityId: 'bare', componentName: 'nonexistent' });
    expect(result).toBeNull();
  });
});
