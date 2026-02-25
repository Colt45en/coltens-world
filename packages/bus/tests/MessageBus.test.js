import { MessageBus } from '../src/MessageBus.js';

describe('MessageBus', () => {
  let bus;
  beforeEach(() => { bus = new MessageBus(); });

  test('starts at tick 0', () => {
    expect(bus.tick).toBe(0);
  });

  test('advanceTick increments the tick counter', () => {
    bus.advanceTick();
    bus.advanceTick();
    expect(bus.tick).toBe(2);
  });

  test('on/emit delivers payload to subscriber', () => {
    const received = [];
    bus.on('test:event', (payload) => received.push(payload));
    bus.emit('test:event', { x: 1 });
    bus.emit('test:event', { x: 2 });
    expect(received).toEqual([{ x: 1 }, { x: 2 }]);
  });

  test('unsubscribe removes the handler', () => {
    const calls = [];
    const unsub = bus.on('ping', (p) => calls.push(p));
    bus.emit('ping', 'a');
    unsub();
    bus.emit('ping', 'b');
    expect(calls).toEqual(['a']);
  });

  test('emit with no subscribers does not throw', () => {
    expect(() => bus.emit('no:listeners', {})).not.toThrow();
  });

  test('log records every emitted message with tick info', () => {
    bus.emit('foo', 1);
    bus.advanceTick();
    bus.emit('bar', 2);
    const log = bus.log;
    expect(log).toHaveLength(2);
    expect(log[0]).toEqual({ tick: 0, topic: 'foo', payload: 1 });
    expect(log[1]).toEqual({ tick: 1, topic: 'bar', payload: 2 });
  });

  test('log is frozen (immutable slice)', () => {
    bus.emit('x', 0);
    const log = bus.log;
    expect(() => { log.push({ tick: 0, topic: 'hack', payload: null }); }).toThrow();
  });

  test('reset clears log, subscriptions, and tick', () => {
    const calls = [];
    bus.on('e', (p) => calls.push(p));
    bus.emit('e', 1);
    bus.advanceTick();
    bus.reset();
    expect(bus.tick).toBe(0);
    expect(bus.log).toHaveLength(0);
    bus.emit('e', 2);
    expect(calls).toEqual([1]); // handler was cleared
  });

  test('multiple subscribers on same topic all receive the event', () => {
    const a = [], b = [];
    bus.on('multi', p => a.push(p));
    bus.on('multi', p => b.push(p));
    bus.emit('multi', 42);
    expect(a).toEqual([42]);
    expect(b).toEqual([42]);
  });
});
