import { TrainGraph } from './graph';
import { CountSet } from './helper/maps';


/**
 * Information stored between two nodes.
 */
interface EdgeImpl<K> {
  low: K;
  high: K;
  length: number;
}


interface NodeSideImpl<K> {
  through: Set<K>;
  edge: EdgeImpl<K>;
}


/**
 * Information stored at every node.
 */
interface NodeImpl<K, S> {
  id: K;
  other: Map<K, NodeSideImpl<K>>;
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


function assertPositiveInteger(check: number) {
  if (check <= 0 || ~~check !== check) {
    throw new Error(`check must be +ve integer: ${check}`);
  }
}


export class TrainGraphImpl<K, S, D> implements TrainGraph<K, S, D> {
  #nodes = new Map<K, NodeImpl<K, S>>();
  #slices = new Map<S, SliceImpl<K>>();

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
    assertPositiveInteger(length);
    if (low === high) {
      throw new Error(`can't join to self: ${low}`);
    }

    const lowNode = this.#implicitNode(low);
    if (lowNode.other.has(high)) {
      return false;
    }

    const edge: EdgeImpl<K> = {
      low,
      high,
      length,
    };

    const highNode = this.#implicitNode(high);

    lowNode.other.set(high, {
      through: new Set(),
      edge,
    });
    highNode.other.set(low, {
      through: new Set(),
      edge,
    });

    return true;
  }

  lookupEdge(a: K, b: K): { length: number; low: K; high: K; } | undefined {
    const aNode = this.#implicitNode(a);
    const e = aNode.other.get(b);
    return e ? {...e.edge} : undefined;
  }

  deleteEdge(a: K, b: K): boolean {
    const aNode = this.#implicitNode(a);
    const e = aNode.other.get(b);

    if (e === undefined) {
      return false;
    }
    // TODO: not if slices are here

    aNode.other.delete(b);

    const bNode = this.#implicitNode(b);
    bNode.other.delete(a);

    return true;
  }

  addDivision(at: K, div: D): void {
    throw new Error('Method not implemented.');
  }

  deleteDivision(at: K, div: D): void {
    throw new Error('Method not implemented.');
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
    // TODO: not if slices span this connection

    aSide.through.delete(b);
    bSide!.through.delete(a);
    return true;
  }

  lookupNode(at: K): { other: Map<K, K[]> } {
    // TODO: return unique pairs
    const node = this.#implicitNode(at);

    const other = new Map<K, K[]>();
    for (const [o, side] of node.other) {
      other.set(o, [...side.through]);
    };

    return {
      other,
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

  growSlice(id: S, end: 1 | -1, by: number, where?: (choices: K[]) => K | undefined): number {
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

    if (by > 0) {
      // grow

      for (;;) {
        let nodeId: K;
        let newlyAbutting = false;

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
        } else {
          slice.along.unshift(choice);
          slice.back = side.edge.length;
        }
      }

      return max - by;
    }

    // otherwise, shrink
    throw new Error('TODO');
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
      // TODO: delete along segmnets

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

  lookupSlice(id: S): { along: K[]; front: number; back: number; } | undefined {
    const slice = this.#slices.get(id);
    if (!slice) {
      return undefined;
    }

    return { along: [...slice.along], front: slice.front, back: slice.back };
  }

  querySlice(id: S): { other: K[]; } {
    throw new Error('Method not implemented.');
  }
  
}