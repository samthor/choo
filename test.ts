// @ts-ignore
import test from 'node:test';
import assert from 'node:assert';

import { TrainGraphImpl } from './tg';

test('check something', () => {

  const tg = new TrainGraphImpl<string, number, string>();

  // edge creation tests

  assert(!tg.deleteEdge('z1', 'z2'));
  assert(tg.addEdge('z1', 'z2', 1));
  assert(!tg.addEdge('z1', 'z2', 1));
  assert(tg.deleteEdge('z1', 'z2'));
  assert(!tg.deleteEdge('z1', 'z2'));

  assert.throws(() => tg.addEdge('a', 'b', -1));
  assert.throws(() => tg.addEdge('a', 'b', 0));
  assert.throws(() => tg.addEdge('a', 'b', 0.125));

  assert(tg.addEdge('a', 'b', 123));
  assert(!tg.addEdge('a', 'b', 123));

  assert(tg.addEdge('b', 'c', 10));

  assert.deepStrictEqual(tg.lookupEdge('b', 'a'), {
    low: 'a',
    high: 'b',
    length: 123,
    slices: [],
  }, 'lookup should work regardless of node order');

  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', []],
      ['c', []],
    ]),
    slices: [],
  });

  // connection tests

  assert(!tg.connect('a', 'c', 'b'), 'not edge joined');
  assert.throws(() => tg.connect('a', 'b', 'a'), 'can\'t connect to self');

  assert(tg.connect('a', 'b', 'c'));
  assert(!tg.connect('a', 'b', 'c'), 'already connected');
  assert(!tg.connect('c', 'b', 'a'), 'already connected');

  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', ['c']],
      ['c', ['a']],
    ]),
    slices: [],
  });

  assert(tg.disconnect('c', 'b', 'a'), 'disconnect');

  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', []],
      ['c', []],
    ]),
    slices: [],
  });

  assert(tg.connect('c', 'b', 'a'), 'new connection');

  // test slices

  assert(!tg.deleteSlice(1234));
  assert(tg.addSlice(1234, 'random-node'), 'add to random node OK');
  assert.strictEqual(tg._nodesForTest().get('random-node')?.slices.count(), 1);
  assert(tg.deleteSlice(1234));
  assert(!tg.deleteSlice(1234));
  assert.strictEqual(tg._nodesForTest().get('random-node')?.slices.count(), 0);

  assert(tg.addSlice(1, 'b'));
  assert(!tg.addSlice(1, 'c'), 'already on board');

  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', ['c']],
      ['c', ['a']],
    ]),
    slices: [1],
  });

  assert.strictEqual(tg.growSlice(1, 1, -10), 0, 'can\'t shrink below zero');
  assert.strictEqual(tg.growSlice(1, -1, 0), 0, 'can\'t shrink below zero');

  assert.strictEqual(tg.growSlice(1, 1, 5, (choices) => {
    assert.deepStrictEqual(choices, ['a', 'c']);
    return 'c';
  }), 5);
  assert.strictEqual(tg._nodesForTest().get('c')?.slices.count(), 0, 'not reached `c`');
  assert.strictEqual(tg.growSlice(1, 1, 99, () => { throw new Error(`should not be called`) }), 5);
  assert.strictEqual(tg._nodesForTest().get('c')?.slices.count(), 1, 'reached `c`');

  assert.strictEqual(tg.growSlice(1, -1, 1, () => { throw new Error(`should not be called`) }), 1);
  assert(!tg.disconnect('a', 'b', 'c'));

  assert.strictEqual(tg.growSlice(1, -1, -8), -8, 'removed most');
  assert.strictEqual(tg.growSlice(1, 1, -10), -3, 'removed all');

  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', ['c']],
      ['c', ['a']],
    ]),
    slices: [],  // not specifically on edge
  });

  assert.deepStrictEqual(tg.lookupSlice(1), { along: ['b', 'c'], front: 3, back: 7, length: 0 })
  assert(!tg.deleteEdge('b', 'c'));

  assert.deepStrictEqual(tg.lookupEdge('b', 'c'), {
    low: 'b',
    high: 'c',
    length: 10,
    slices: [1],
  });
});
