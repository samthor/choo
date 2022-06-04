import { TrainGraph } from './graph';


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
interface NodeImpl<K> {
  id: K;
  other: Map<K, NodeSideImpl<K>>;
}


function assertPositiveInteger(check: number) {
  if (check <= 0 || ~~check !== check) {
    throw new Error(`check must be +ve integer: ${check}`);
  }
}


export class TrainGraphImpl<K, S, D> implements TrainGraph<K, S, D> {
  #nodes = new Map<K, NodeImpl<K>>();

  _nodesForTest() {
    return this.#nodes;
  }

  #implicitNode = (id: K) => {
    const prev = this.#nodes.get(id);
    if (prev !== undefined) {
      return prev;
    }
    const update: NodeImpl<K> = { id, other: new Map() };
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

  connect(a: K, b: K, through: K): boolean {
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

  disconnect(a: K, b: K, through: K): boolean {
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

  lookupNode(at: K): any {
    // TODO: return unique pairs
    const node = this.#implicitNode(at);

    return {
      // other edges connected here
      other: [...node.other.keys()],
      // TODO: connections between these edges
    };
  }

  addSlice(id: S, on: K): void {
    throw new Error('Method not implemented.');
  }

  growSlice(id: S, end: 1 | -1, by: number, where?: (choice: K[]) => K | undefined): void {
    throw new Error('Method not implemented.');
  }

  deleteSlice(id: S): void {
    throw new Error('Method not implemented.');
  }

  lookupSlice(id: S): { along: K[]; front: number; back: number; } {
    throw new Error('Method not implemented.');
  }

  querySlice(id: S): { other: K[]; } {
    throw new Error('Method not implemented.');
  }
  
}