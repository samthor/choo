import { DescribedSlice, TrainGraph } from './graph';

/**
 * @fileoverview Provides some high-level helpers over {@link TrainGraph} especially around complex
 * manipulations like splitting edges.
 *
 * These don't requires internal knowledge and can just do rewriting of things like slices.
 */

const check = (cond: boolean) => {
  if (!cond) {
    throw new Error(`can't splitEdge, invariant failed`);
  }
};

/**
 * Split an edge on the passed {@link TrainGraph}.
 *
 * This works by removing and re-adding all the slices that are on the split edge.
 */
export function splitEdge<K, S>(graph: TrainGraph<K, S, any>, a: K, b: K, at: number, split: K): boolean {
  const edge = graph.lookupEdge(a, b);
  if (edge === undefined) {
    return false;
  }

  if (at !== ~~at) {
    throw new Error(`must split on integer only`);
  }

  // Possibly flip at.
  if (at < 0) {
    at = edge.length + at;
  }

  // Don't allow splits outside the length.
  if (at < 0 || at >= edge.length) {
    return false;
  }

  // Find all slices in this edge and remove them _completely_.
  const slicesAtEdge: [S, DescribedSlice<K, S>][] = edge.slices.map((id) => {
    const slice = graph.lookupSlice(id)!;
    check(graph.deleteSlice(id));
    return [id, slice];
  });

  // Delete the previous edge, and create the new edge, connecting along the new midpoint.
  check(graph.deleteEdge(a, b));
  check(graph.addEdge(a, split, at));
  check(graph.addEdge(split, b, edge.length - at));
  check(graph.connect(a, split, b));

  // Re-add all the slices, swapping out the old [a,b] for the new split edge.
  slicesAtEdge.forEach(([id, slice]) => {
    for (let i = 1; i < slice.along.length; ++i) {
      const rear = slice.along[i - 1];
      const forward = slice.along[i];

      if (!((rear === a && forward === b) || (rear === b && forward === a))) {
        continue;
      }

      slice.along.splice(i, 0, split);
      ++i;

      // Possibly remove the rear edge if the split now causes it to be invalid.
      if (i === 2) {
        const newEdge = graph.lookupEdge(rear, split)!;

        if (slice.back >= newEdge.length) {
          slice.back -= newEdge.length;
          slice.along.shift();
          --i;
        }
      }

      // Possibly remove the front edge if teh split now causes it to be invalid.
      if (i === slice.along.length - 1) {
        const newEdge = graph.lookupEdge(split, forward)!;

        if (slice.front >= newEdge.length) {
          slice.front -= newEdge.length;
          slice.along.pop();
          break;  // we're done anyway
        }
      }
    }

    check(addDescribedSlice(graph, id, slice));
  });

  return true;
}

/**
 * Helper to invert the end. Just for type safety.
 */
export function invertEnd(end: -1|1): -1|1 {
  return (end === -1 ? +1 : -1);
}

/**
 * Moves the slice along a direction. Just grows one end and shrinks another.
 */
export function moveSlice<K, S>(graph: TrainGraph<K, S, any>, id: S, end: -1|1, by: number, where?: (choice: K[]) => K | undefined): number {
  if (by === 0) {
    return 0;
  }

  const growBy = graph.modifySlice(id, end, by, where);
  const invertShrinkBy = graph.modifySlice(id, invertEnd(end), -growBy);

  if (growBy !== -invertShrinkBy) {
    throw new Error(`cannot shrink by growth amount?!`);
  }

  return growBy;
}

/**
 * Adds the described slice to the graph under the specified ID. Returns false if the slice cannot
 * be added (already on the board, or invalid specification - will be removed).
 */
export function addDescribedSlice<K, S>(graph: TrainGraph<K, S, any>, id: S, slice: DescribedSlice<K, S>): boolean {
  if (slice.along.length === 0) {
    throw new Error(`invalid slice, no along nodes`);
  }

  if (!graph.addSlice(id, slice.along[0])) {
    return false;  // already on board
  }

  // If this was just a slice on a single node, we're done.
  if (slice.along.length === 1) {
    return true;
  }

  let ok = false;

  try {
    // Move towards start. Might be zero. This moves towards the 'back' as we are setting up to
    // move forward the front for the rest of the distance.
    const movedBy = moveSlice(graph, id, 1, slice.back, () => slice.along[1]);
    if (movedBy !== slice.back) {
      return false;
    }

    // Grow to contain all remaining points.
    let i = 1;
    const growth = graph.modifySlice(id, 1, slice.length, () => {
      const here = i;
      ++i;
      return slice.along[here];
    });

    // If we grew the slice's original length, we're on the board.
    if (growth !== slice.length) {
      return false;
    }

    ok = true;
    return true;
  } finally {
    if (!ok) {
      check(graph.deleteSlice(id));
    }
  }
}

/**
 * Clones the identified slice to a new ID.
 */
export function cloneSlice<K, S>(graph: TrainGraph<K, S, any>, prev: S, add: S): boolean {
  const s = graph.lookupSlice(prev);
  if (s === undefined) {
    return false;
  }
  return addDescribedSlice(graph, add, s);
}
