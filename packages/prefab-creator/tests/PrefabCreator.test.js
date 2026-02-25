import { PrefabDef, PrefabRegistry } from '../src/PrefabCreator.js';
import { MessageBus } from '../../bus/src/MessageBus.js';
import { WorldEngine } from '../../world-engine/src/WorldEngine.js';

function makeRegistry() {
  const reg = new PrefabRegistry();
  reg.register(new PrefabDef('base', { hp: 100, speed: 5 }));
  reg.register(new PrefabDef('hero', { speed: 10, power: 50 }, 'base'));
  return reg;
}

describe('PrefabDef', () => {
  test('toJSON / fromJSON round-trip', () => {
    const def = new PrefabDef('test', { x: 1 }, 'parent');
    def.tags = ['a', 'b'];
    const json  = def.toJSON();
    const copy  = PrefabDef.fromJSON(json);
    expect(copy.name).toBe('test');
    expect(copy.components).toEqual({ x: 1 });
    expect(copy.parent).toBe('parent');
    expect(copy.tags).toEqual(['a', 'b']);
  });
});

describe('PrefabRegistry', () => {
  test('register and get', () => {
    const reg = makeRegistry();
    expect(reg.get('base')).toBeDefined();
    expect(reg.get('hero')).toBeDefined();
  });

  test('names lists all prefabs', () => {
    const reg = makeRegistry();
    expect(reg.names.sort()).toEqual(['base', 'hero']);
  });

  test('resolve returns own components for root prefab', () => {
    const reg = makeRegistry();
    expect(reg.resolve('base')).toEqual({ hp: 100, speed: 5 });
  });

  test('resolve merges parent components (child overrides parent)', () => {
    const reg = makeRegistry();
    const resolved = reg.resolve('hero');
    expect(resolved.hp).toBe(100);       // inherited
    expect(resolved.speed).toBe(10);     // overridden
    expect(resolved.power).toBe(50);     // own
  });

  test('resolve throws for unknown prefab', () => {
    const reg = makeRegistry();
    expect(() => reg.resolve('ghost')).toThrow("Prefab 'ghost' not found");
  });

  test('instantiate spawns entity with resolved components', () => {
    const reg   = makeRegistry();
    const bus   = new MessageBus();
    const world = new WorldEngine(bus);
    reg.instantiate('hero', 'hero-1', {}, world);
    const e = world.getEntity('hero-1');
    expect(e).toBeDefined();
    expect(e.components.get('hp')).toBe(100);
    expect(e.components.get('speed')).toBe(10);
    expect(e.components.get('_prefab')).toBe('hero');
  });

  test('instantiate applies per-call overrides', () => {
    const reg   = makeRegistry();
    const bus   = new MessageBus();
    const world = new WorldEngine(bus);
    reg.instantiate('base', 'custom', { hp: 999 }, world);
    expect(world.getComponent('custom', 'hp')).toBe(999);
  });

  test('exportAll / importAll round-trip', () => {
    const reg1 = makeRegistry();
    const json  = reg1.exportAll();
    const reg2  = new PrefabRegistry();
    reg2.importAll(json);
    expect(reg2.names.sort()).toEqual(['base', 'hero']);
    expect(reg2.resolve('hero').hp).toBe(100);
  });
});
