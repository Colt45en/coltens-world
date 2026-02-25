import { MessageBus } from '../../bus/src/MessageBus.js';
import { WorldEngine } from '../src/WorldEngine.js';

function makeWorld() {
  const bus = new MessageBus();
  const world = new WorldEngine(bus);
  return { bus, world };
}

describe('WorldEngine', () => {
  test('spawn creates an entity with components', () => {
    const { world } = makeWorld();
    world.spawn('e1', { hp: 100, pos: { x: 0, y: 0 } });
    const e = world.getEntity('e1');
    expect(e).toBeDefined();
    expect(e.components.get('hp')).toBe(100);
  });

  test('spawn throws if id already exists', () => {
    const { world } = makeWorld();
    world.spawn('dup');
    expect(() => world.spawn('dup')).toThrow("Entity 'dup' already exists");
  });

  test('despawn removes the entity', () => {
    const { world } = makeWorld();
    world.spawn('e2');
    world.despawn('e2');
    expect(world.getEntity('e2')).toBeUndefined();
  });

  test('despawn is a no-op for unknown id', () => {
    const { world } = makeWorld();
    expect(() => world.despawn('ghost')).not.toThrow();
  });

  test('setComponent / getComponent round-trip', () => {
    const { world } = makeWorld();
    world.spawn('e3', {});
    world.setComponent('e3', 'velocity', { x: 5, y: -3 });
    expect(world.getComponent('e3', 'velocity')).toEqual({ x: 5, y: -3 });
  });

  test('setComponent throws for unknown entity', () => {
    const { world } = makeWorld();
    expect(() => world.setComponent('missing', 'c', {})).toThrow("Entity 'missing' not found");
  });

  test('entities getter returns all spawned entities', () => {
    const { world } = makeWorld();
    world.spawn('a');
    world.spawn('b');
    expect(world.entities.map(e => e.id).sort()).toEqual(['a', 'b']);
  });

  test('tick runs systems and advances the bus tick', () => {
    const { bus, world } = makeWorld();
    const calls = [];
    world.registerSystem('test-sys', (entities, dt) => calls.push({ count: entities.length, dt }));
    world.spawn('x');
    world.tick(0.1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ count: 1, dt: 0.1 });
    expect(bus.tick).toBe(1);
  });

  test('tick emits world:tick event', () => {
    const { bus, world } = makeWorld();
    const ticks = [];
    bus.on('world:tick', (p) => ticks.push(p));
    world.tick();
    world.tick();
    expect(ticks).toHaveLength(2);
    expect(ticks[0].tick).toBe(1);
    expect(ticks[1].tick).toBe(2);
  });

  test('removeSystem stops system from running', () => {
    const { world } = makeWorld();
    const calls = [];
    world.registerSystem('removable', () => calls.push(1));
    world.tick();
    world.removeSystem('removable');
    world.tick();
    expect(calls).toHaveLength(1);
  });

  test('snapshot returns JSON-serialisable world state', () => {
    const { world } = makeWorld();
    world.spawn('s1', { pos: { x: 1, y: 2 } });
    const snap = world.snapshot();
    expect(snap).toHaveProperty('tick');
    expect(snap.entities.s1.pos).toEqual({ x: 1, y: 2 });
  });

  test('bus events are emitted on spawn and despawn', () => {
    const { bus, world } = makeWorld();
    const spawned   = [];
    const despawned = [];
    bus.on('world:entity:spawned',   p => spawned.push(p.id));
    bus.on('world:entity:despawned', p => despawned.push(p.id));
    world.spawn('ev-entity');
    world.despawn('ev-entity');
    expect(spawned).toEqual(['ev-entity']);
    expect(despawned).toEqual(['ev-entity']);
  });
});
