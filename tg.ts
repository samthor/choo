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
  along: K[];
  front: number;
  back: number;
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

  growSlice(id: S, end: 1 | -1, by: number, where?: (choice: K[]) => K | undefined): number {
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
    } else {
      // shrink
    }

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
        slice.along.shift();
      }
      if (slice.back !== 0) {
        slice.along.pop();
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