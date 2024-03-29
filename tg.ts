import { DescribedSlice, TrainGraph, TrainGraphEdgeFeed } from './graph';
import { CountSet, PairSet } from './helper/maps';
import { arrayContainsSub } from './helper/array';


/**
 * Information stored between two nodes.
 */
interface EdgeImpl<K, S> {
  low: K;
  high: K;
  length: number;

  // TODO: this says something is here, but not if it's full or partial
  slices: CountSet<S>;
}


interface NodeSideImpl<K, S> {
  through: Set<K>;
  edge: EdgeImpl<K, S>;
}


/**
 * Information stored at every node.
 */
interface NodeImpl<K, S> {
  id: K;
  other: Map<K, NodeSideImpl<K, S>>;
  slices: CountSet<S>;
}


/**
 * Slice descriptor.
 */
interface SliceImpl<K> {
  along: K[];     // front is high, back is low
  front: number;  // distance from along[-1]
  back: number;   // distance from along[0]
  length: number;
}


function check(cond: boolean) {
  if (!cond) {
    throw new Error(`check assert failed`);
  }
}


class EdgeEventImpl<K> extends Event {
  a: K;
  b: K;
  length: number;

  constructor(a: K, b: K, length: number) {
    super('edge');
    this.a = a;
    this.b = b;
    this.length = length;
  }
}


export class TrainGraphImpl<K, S> extends EventTarget implements TrainGraph<K, S>, TrainGraphEdgeFeed<K> {
  #nodes = new Map<K, NodeImpl<K, S>>();
  #slices = new Map<S, SliceImpl<K>>();
  #edges = new Set<EdgeImpl<K, S>>();

  _nodesForTest() {
    return this.#nodes;
  }

  #implicitNode = (id: K) => {
    const prev = this.#nodes.get(id);
    if (prev !== undefined) {
      return prev;
    }
    const update: NodeImpl<K, S> = { id, other: new Map(), slices: new CountSet() };
    this.#nodes.set(id, update);
    return update;
  };

  addEdge(low: K, high: K, length: number): boolean {
    if (length <= 0 || ~~length !== length) {
      throw new Error(`length must be +ve integer: ${length}`);
    }
    if (low === high) {
      throw new Error(`can't join to self: ${low}`);
    }

    const lowNode = this.#implicitNode(low);
    if (lowNode.other.has(high)) {
      return false;
    }

    const edge: EdgeImpl<K, S> = {
      low,
      high,
      length,
      slices: new CountSet(),
    };
    this.#edges.add(edge);

    const highNode = this.#implicitNode(high);

    lowNode.other.set(high, {
      through: new Set(),
      edge,
    });
    highNode.other.set(low, {
      through: new Set(),
      edge,
    });

    this.dispatchEvent(new EdgeEventImpl(low, high, length));
    return true;
  }

  lookupEdge(a: K, b: K): { length: number, low: K, high: K, slices: S[] } | undefined {
    const aNode = this.#implicitNode(a);
    const side = aNode.other.get(b);
    if (!side) {
      return undefined;
    }
    const { edge } = side;
    return {
      low: edge.low,
      high: edge.high,
      length: edge.length,

      // TODO: just uniques for render
      slices: [...edge.slices.uniques()],
    };
  }

  deleteEdge(a: K, b: K): boolean {
    const aNode = this.#implicitNode(a);
    const bNode = this.#implicitNode(b);

    const aToBSide = aNode.other.get(b);
    if (aToBSide === undefined) {
      return false;
    }
    const edge = aToBSide.edge;

    // There's slices here, so the edge can't be deleted.
    if (edge.slices.total() !== 0) {
      return false;
    }
    this.#edges.delete(edge);

    aToBSide.through.forEach((check) => {
      aNode.other.get(check)?.through.delete(b);
    });
    aNode.other.delete(b);

    const bToASide = bNode.other.get(a)!;
    bToASide.through.forEach((check) => {
      bNode.other.get(check)?.through.delete(a);
    });
    bNode.other.delete(a);

    this.dispatchEvent(new EdgeEventImpl(a, b, 0));
    return true;
  }

  connect(a: K, through: K, b: K): boolean {
    if (a === b || through === a || through === b) {
      throw new Error(`joins must be unique`);
    }

    const throughNode = this.#implicitNode(through);
    const aSide = throughNode.other.get(a);
    const bSide = throughNode.other.get(b);

    // We can't connect, the edges aren't joined.
    if (aSide === undefined || bSide === undefined) {
      return false;
    }

    // Already connected.
    if (aSide.through.has(b)) {
      return false;
    }

    aSide.through.add(b);
    bSide.through.add(a);
    return true;
  }

  disconnect(a: K, through: K, b: K): boolean {
    const throughNode = this.#implicitNode(through);
    const aSide = throughNode.other.get(a);
    const bSide = throughNode.other.get(b);

    // Not connected.
    if (!aSide?.through.has(b)) {
      return false;
    }

    // Check slices that might go through here.
    // TODO: this is slow - O(n * m), n = slices here, m = slice length
    for (const s of throughNode.slices.uniques()) {
      const slice = this.#slices.get(s)!;

      // Find anywhere that the slice follows this connection.
      if (arrayContainsSub(slice.along, [a, through, b]) || arrayContainsSub(slice.along, [b, through, a])) {
        return false;
      }
    }

    aSide.through.delete(b);
    bSide!.through.delete(a);
    return true;
  }

  lookupNode(at: K): { other: Map<K, K[]>, slices: S[] } {
    const node = this.#implicitNode(at);

    const other = new Map<K, K[]>();
    for (const [o, side] of node.other) {
      other.set(o, [...side.through]);
    };

    return {
      other,

      // TODO: just uniques for render
      slices: [...node.slices.uniques()],
    };
  }

  addSlice(id: S, on: K): boolean {
    if (this.#slices.has(id)) {
      return false;
    }

    const slice = { along: [on], front: 0, back: 0, length: 0 };
    this.#slices.set(id, slice);

    const node = this.#implicitNode(on);
    node.slices.add(id);

    return true;
  }

  modifySlice(id: S, end: 1 | -1, by: number, where?: (choices: K[]) => K | undefined): number {
    const slice = this.#slices.get(id);
    if (slice === undefined) {
      return 0;  // cannot grow slice not on board
    }

    if (by < 0) {
      // e.g., reduce by -100, but length is 50, brings to -50
      by = Math.max(by, -slice.length);
    }
    if (by === 0) {
      return 0;
    }
    const max = by;

    if (by < 0) {
      // shrink
      by = -by;
      while (by > 0) {
        if (slice.along.length === 1) {
          throw new Error(`still have by=${by} even with single node`);
        }

        // By definition, we can consume the "head" edge.
        const nodeId = slice.along.at(end === 1 ? -1 : 0)!;
        const prevNodeId = slice.along.at(end === 1 ? -2 : 1)!;
        const node = this.#implicitNode(nodeId);
        const side = node.other.get(prevNodeId)!;

        let wasAbutting: boolean;

        // Consume as much along this edge as we can.
        if (end === 1) {
          let max = side.edge.length - slice.front;
          if (slice.along.length === 2) {
            max -= slice.back;  // only on this edge
          }
          wasAbutting = (slice.front === 0);
          const amount = Math.min(max, by);
          slice.front += amount;
          by -= amount;

          // We might remove the front edge.
          if (slice.front === side.edge.length) {
            slice.along.pop();
            slice.front = 0;
            side.edge.slices.delete(id);
          }
        } else {
          let max = side.edge.length - slice.back;
          if (slice.along.length === 2) {
            max -= slice.front;  // only on this edge
          }
          wasAbutting = (slice.back === 0);
          const amount = Math.min(max, by);
          slice.back += amount;
          by -= amount;

          // We might remove the back edge.
          if (slice.back === side.edge.length) {
            slice.along.shift();
            slice.back = 0;
            side.edge.slices.delete(id);
          }
        }

        // If we were previously abutting the node, then remove our presence.
        if (wasAbutting) {
          node.slices.delete(id);
        }
      }

      slice.length += max;  // max is -ve

      check(slice.along.length !== 0);
      if (slice.length === 0) {
        check(slice.along.length <= 2);  // can be a single or pair
      } else {
        check(slice.along.length >= 2);
      }
      check(slice.length >= 0);

      return max;  // will be -ve
    }

    // otherwise, grow!
    for (; ;) {
      let nodeId: K;
      let newlyAbutting: boolean;

      // Consume as much along this edge as we can. This might be zero if already abutting.
      if (end === 1) {
        nodeId = slice.along.at(-1)!;
        const amount = Math.min(slice.front, by);
        slice.front -= amount;
        by -= amount;

        newlyAbutting = amount > 0 && slice.front === 0;
      } else {
        nodeId = slice.along[0];
        const amount = Math.min(slice.back, by);
        slice.back -= amount;
        by -= amount;

        newlyAbutting = amount > 0 && slice.back === 0;
      }

      // Get the node we might be abutting against.
      const node = this.#implicitNode(nodeId);

      // If we're now newly abutting the node then record our presence again. We might already be
      // here if the slice has looped around a bunch.
      if (newlyAbutting) {
        node.slices.add(id);
      }

      check(by >= 0);
      if (by === 0) {
        break;  // nothing more to do, either abutting or not
      }

      // At this point, we're abutting the target node and want to go further, so let the caller
      // decide where to go (or choose for them if there's only one option).
      // TODO: maybe always force a choice
      let choices: K[];

      if (slice.along.length === 1) {
        choices = [...node.other.keys()];  // can go anywhere, node is O(1)
      } else {
        // Step back a node and see what direction the slice can go in.
        const prev = slice.along.at(end === 1 ? -2 : 1)!;
        choices = [...node.other.get(prev)?.through ?? []];  // only connections
      }

      const choice: K | undefined = choices.length > 1 && where?.(choices) || choices[0];
      if (choice === undefined) {
        break;  // can't go anywhere
      }

      const side = node.other.get(choice);
      if (side === undefined) {
        break;  // invalid choice
      }

      // Finally, push the choice we made onto the right end.
      if (end === 1) {
        slice.along.push(choice);
        slice.front = side.edge.length;
        side.edge.slices.add(id);
      } else {
        slice.along.unshift(choice);
        slice.back = side.edge.length;
        side.edge.slices.add(id);
      }
    }

    const change = max - by;
    slice.length += change;
    return change;
  }

  deleteSlice(id: S): boolean {
    const slice = this.#slices.get(id);
    if (slice === undefined) {
      return false;
    }

    const along = slice.along;

    // If we're just on a single node, then deletion is pretty easy.
    if (along.length === 1) {
      check(slice.front === 0);
      check(slice.back === 0);

      const node = this.#implicitNode(along[0]);
      check(node.slices.delete(id));
      check(!node.slices.has(id));

    } else {
      // Delete along edges.
      for (let i = 1; i < slice.along.length; ++i) {
        const side = this.#nodes.get(slice.along[i - 1])!.other.get(slice.along[i])!;
        side.edge.slices.delete(id);
      }

      // Check if we're not on the front/end nodes. If so we don't need to remove those cases.
      if (slice.front !== 0) {
        slice.along.pop();
      }
      if (slice.back !== 0) {
        slice.along.shift();
      }
      for (const nodeId of slice.along) {
        const node = this.#implicitNode(nodeId);
        node.slices.delete(id);
      }
    }

    this.#slices.delete(id);
    return true;
  }

  lookupSlice(id: S): DescribedSlice<K, S> | undefined {
    const slice = this.#slices.get(id);
    if (!slice) {
      return undefined;
    }

    return {
      along: [...slice.along],
      front: slice.front,
      back: slice.back,
      length: slice.length,
    };
  }

  querySlice(id: S): { other: K[]; } {
    throw new Error('Method not implemented.');
  }

  *allEdges(): IterableIterator<{ a: K; b: K; length: number; }> {
    for (const edge of this.#edges) {
      yield { a: edge.low, b: edge.high, length: edge.length };
    }
  }

}
