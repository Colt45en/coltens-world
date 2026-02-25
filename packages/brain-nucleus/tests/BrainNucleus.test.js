import { MessageBus } from '../../bus/src/MessageBus.js';
import { WorldEngine } from '../../world-engine/src/WorldEngine.js';
import { BrainNucleus, Brain } from '../src/BrainNucleus.js';

function makeSetup() {
  const bus    = new MessageBus();
  const world  = new WorldEngine(bus);
  const nucleus = new BrainNucleus(bus);
  return { bus, world, nucleus };
}

describe('BrainNucleus', () => {
  test('createBrain returns a Brain instance', () => {
    const { nucleus } = makeSetup();
    const brain = nucleus.createBrain('agent-1');
    expect(brain).toBeInstanceOf(Brain);
  });

  test('createBrain throws on duplicate agentId', () => {
    const { nucleus } = makeSetup();
    nucleus.createBrain('a');
    expect(() => nucleus.createBrain('a')).toThrow("Brain for 'a' already exists");
  });

  test('getBrain returns the created brain', () => {
    const { nucleus } = makeSetup();
    const b = nucleus.createBrain('b');
    expect(nucleus.getBrain('b')).toBe(b);
  });

  test('removeBrain unregisters the brain', () => {
    const { nucleus } = makeSetup();
    nucleus.createBrain('c');
    nucleus.removeBrain('c');
    expect(nucleus.getBrain('c')).toBeUndefined();
  });

  test('agentIds lists all registered ids', () => {
    const { nucleus } = makeSetup();
    nucleus.createBrain('x');
    nucleus.createBrain('y');
    expect(nucleus.agentIds.sort()).toEqual(['x', 'y']);
  });
});

describe('Brain', () => {
  test('remember / recall / forget', () => {
    const { bus, nucleus } = makeSetup();
    const brain = nucleus.createBrain('mem-agent');
    brain.remember('score', 99);
    expect(brain.recall('score')).toBe(99);
    brain.forget('score');
    expect(brain.recall('score')).toBeUndefined();
  });

  test('planner + action fires on tick', () => {
    const { bus, world, nucleus } = makeSetup();
    const brain  = nucleus.createBrain('planner-agent');
    const actions = [];

    brain.addPlanner(() => 'do-thing');
    brain.registerAction('do-thing', () => actions.push('done'));

    world.tick();
    expect(actions).toEqual(['done']);
  });

  test('planner returning null skips action', () => {
    const { bus, world, nucleus } = makeSetup();
    const brain  = nucleus.createBrain('null-planner');
    const actions = [];

    brain.addPlanner(() => null);
    brain.registerAction('fallback', () => actions.push('fallback'));

    world.tick();
    expect(actions).toHaveLength(0);
  });

  test('first non-null planner wins', () => {
    const { bus, world, nucleus } = makeSetup();
    const brain  = nucleus.createBrain('first-wins');
    const log = [];

    brain.addPlanner(() => null);
    brain.addPlanner(() => 'second');
    brain.addPlanner(() => 'third');
    brain.registerAction('second', () => log.push('second'));
    brain.registerAction('third',  () => log.push('third'));

    world.tick();
    expect(log).toEqual(['second']);
  });

  test('brain:action event emitted on each action', () => {
    const { bus, world, nucleus } = makeSetup();
    const brain  = nucleus.createBrain('event-agent');
    const events = [];

    bus.on('brain:action', e => events.push(e.action));
    brain.addPlanner(() => 'jump');
    brain.registerAction('jump', () => {});

    world.tick();
    expect(events).toEqual(['jump']);
  });
});
