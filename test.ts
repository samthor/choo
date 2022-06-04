// @ts-ignore
import test from 'node:test';
import assert from 'node:assert';

import { TrainGraphImpl } from './tg';

test('check something', () => {

  const tg = new TrainGraphImpl<string, number, string>();

  // edge creation tests

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
  }, 'lookup should work regardless of node order');

  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', []],
      ['c', []],
    ]),
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
  });

  assert(tg.disconnect('c', 'b', 'a'), 'disconnect');

  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', []],
      ['c', []],
    ]),
  });

  assert(tg.connect('c', 'b', 'a'), 'new connection');

  // test slices

  assert(!tg.deleteSlice(1234));
  assert(tg.addSlice(1234, 'random-node'), 'add to random node OK');
  assert(tg._nodesForTest().get('random-node')?.slices.count() === 1);
  assert(tg.deleteSlice(1234));
  assert(!tg.deleteSlice(1234));
  assert(tg._nodesForTest().get('random-node')?.slices.count() === 0);

  assert(tg.addSlice(1, 'b'));
  assert(!tg.addSlice(1, 'c'), 'already on board');

});
