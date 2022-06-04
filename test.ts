// @ts-ignore
import test from 'node:test';
import assert from 'node:assert';
import { TrainGraphImpl } from './tg';

test('check something', () => {

  const tg = new TrainGraphImpl<string, string, string>();

  assert(tg.addEdge('a', 'b', 123));

});
