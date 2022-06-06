// @ts-ignore
import test from 'node:test';
import assert from 'node:assert';

import { TrainGraphImpl } from './tg';
import * as helpers from './graph-helpers';
import { ComponentGraph, DivisionGraphImpl } from './component';

test('check something', () => {
  const tg = new TrainGraphImpl<string, number>();

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

  assert.strictEqual(tg.modifySlice(1, 1, -10), 0, 'can\'t shrink below zero');
  assert.strictEqual(tg.modifySlice(1, -1, 0), 0, 'can\'t shrink below zero');

  assert.strictEqual(tg.modifySlice(1, 1, 5, (choices) => {
    assert.deepStrictEqual(choices, ['a', 'c']);
    return 'c';
  }), 5);
  assert.strictEqual(tg._nodesForTest().get('c')?.slices.count(), 0, 'not reached `c`');
  assert.strictEqual(tg.modifySlice(1, 1, 99, () => { throw new Error(`should not be called`) }), 5);
  assert.strictEqual(tg._nodesForTest().get('c')?.slices.count(), 1, 'reached `c`');

  assert.strictEqual(tg.modifySlice(1, -1, 1, () => { throw new Error(`should not be called`) }), 1);
  assert(!tg.disconnect('a', 'b', 'c'));

  assert.strictEqual(tg.modifySlice(1, -1, -8), -8, 'removed most');
  assert.strictEqual(tg.modifySlice(1, 1, -10), -3, 'removed all');

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

test('check deleting connections', () => {
  const tg = new TrainGraphImpl<string, number>();

  assert(tg.addEdge('a', 'b', 10));
  assert(tg.addEdge('c', 'b', 17));

  assert(tg.connect('a', 'b', 'c'));
  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', ['c']],
      ['c', ['a']],
    ]),
    slices: [],
  });

  assert(tg.deleteEdge('b', 'c'));
  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', []],  // b still has edge to a
    ]),
    slices: [],
  });

  assert(tg.addEdge('c', 'b', 4));
  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', []],
      ['c', []],
    ]),
    slices: [],
  }, 'confirm that connection is not implicitly re-added');

});

test('helpers', () => {
  const tg = new TrainGraphImpl<string, number>();

  assert(tg.addEdge('a', 'b', 10));
  assert(tg.addEdge('c', 'b', 17));
  assert(tg.connect('a', 'b', 'c'));

  assert(tg.addSlice(1, 'b'));
  assert(tg.modifySlice(1, 1, 3, () => 'c'));
  assert.deepStrictEqual(tg.lookupSlice(1), {
    along: ['b', 'c'],
    back: 0,
    front: 14,
    length: 3,
  });

  assert(helpers.cloneSlice(tg, 1, 2));

  assert.deepStrictEqual(tg.lookupSlice(2), {
    along: ['b', 'c'],
    back: 0,
    front: 14,
    length: 3,
  });

  assert.deepStrictEqual(tg.lookupNode('b'), {
    other: new Map([
      ['a', ['c']],
      ['c', ['a']],
    ]),
    slices: [1, 2],
  });

  assert(helpers.splitEdge(tg, 'c', 'b', 10, 'q1'));  // b->q1 will be 7 length
  assert(helpers.splitEdge(tg, 'b', 'q1', 2, 'q2'));  // b->q2 = 2, q2->q1 = 5, q1->c = 10

  assert.deepStrictEqual(tg.lookupSlice(2), {
    along: ['b', 'q2', 'q1'],
    back: 0,
    front: 4,
    length: 3,
  });
});

test('component', () => {
  const x = new ComponentGraph<number>();

  assert(x.add(1, 2));
  assert(!x.add(2, 1));
  assert(x.add(100, 101));
  assertIteratorAnyOrder(x.sharedWith(1), [1, 2]);

  assert(x.add(2, 3));
  assert(x.add(3, 4));
  assert(x.add(2, 4));
  assertIteratorAnyOrder(x.sharedWith(1), [1, 2, 3, 4]);

  assert(x.delete(3, 4));
  assertIteratorAnyOrder(x.sharedWith(1), [1, 2, 3, 4]);

  assert(x.add(0, 1));
  assertIteratorAnyOrder(x.sharedWith(1), [0, 1, 2, 3, 4]);

  assert(x.delete(1, 2));
  assertIteratorAnyOrder(x.sharedWith(1), [0, 1]);
  assertIteratorAnyOrder(x.sharedWith(2), [2, 3, 4]);

  assert(x.add(1, 2));
  assertIteratorAnyOrder(x.sharedWith(1), [0, 1, 2, 3, 4]);
});

test('maintains division graph', () => {
  const tg = new TrainGraphImpl<string, number>();
  tg.addEdge('n1', 'n2', 100);

  const controller = new AbortController();

  const dg = new DivisionGraphImpl(tg, controller.signal);
  assertIteratorAnyOrder(dg.lookupDivisionByEdge('n1', 'n2'), [ { a: 'n1', b: 'n2' } ]);

  tg.addEdge('n2', 'n3', 100);
  assertIteratorAnyOrder(dg.lookupDivisionByEdge('n1', 'n2'), [ { a: 'n1', b: 'n2' }, { a: 'n2', b: 'n3' } ]);

  dg.addDivision('n2');
  assertIteratorAnyOrder(dg.lookupDivisionByEdge('n1', 'n2'), [ { a: 'n1', b: 'n2' } ]);
  assertIteratorAnyOrder(dg.lookupDivisionByEdge('n3', 'n2'), [ { a: 'n2', b: 'n3' } ]);

  controller.abort();
  assertIteratorAnyOrder(dg.lookupDivisionByEdge('n1', 'n2'), []);

});


/**
 * Confirm that the iterator contains the expected values, in any order.
 */
function assertIteratorAnyOrder(actual: Iterable<any>, expected: Iterable<any>) {
  const check = [...expected];

  for (const value of actual) {
    let index = 0;
    for (; index < check.length; ++index) {
      try {
        // Node doesn't really have this aside in assert.
        assert.deepStrictEqual(value, check[index]);
        break;
      } catch {}
    }

    if (index === check.length) {
      throw new Error(`mising value: ${value}`);
    }
    check.splice(index, 1);
  }

  if (check.length) {
    throw new Error(`remaining values: ${check}`);
  }
}
