import { DivisionGraph, EdgeEvent, TrainGraphEdgeFeed } from './graph';
import { PairMap } from './helper/maps';
import { ComponentGraphSlowImpl } from './component/component-slow';


/**
 * Internal edge class used by {@link DivisionComponentGraphInternal} to distinguish from nodes
 * themselves.
 */
class DivisionEdgeNode<K> {
  readonly a: K;
  readonly b: K;

  constructor(a: K, b: K) {
    this.a = a;
    this.b = b;
  }
}


/**
 * This wraps an actual component graph by creating 'nodes' for each edge.
 */
class DivisionComponentGraphInternal<K> {
  #blockedNodes = new Set<K>();
  #edgeNodes = new PairMap<K, DivisionEdgeNode<K>>();
  #actual = new ComponentGraphSlowImpl<K | DivisionEdgeNode<K>>();

  addEdge(a: K, b: K): boolean {
    if (this.#edgeNodes.has(a, b)) {
      return false;
    }

    // This is just a unique object. It doesn't need the A/B side info.
    const edgeNode = new DivisionEdgeNode(a, b);
    this.#edgeNodes.set(a, b, edgeNode);

    if (!this.#blockedNodes.has(a)) {
      this.#actual.add(a, edgeNode);
    }

    if (!this.#blockedNodes.has(b)) {
      this.#actual.add(b, edgeNode);
    }

    return true;
  }

  hasEdge(a: K, b: K): boolean {
    return this.#edgeNodes.has(a, b);
  }

  deleteEdge(a: K, b: K): boolean {
    const edgeNode = this.#edgeNodes.get(a, b);
    if (edgeNode === undefined) {
      return false;
    }

    // Delete the sides. This is harmless even if blocked.
    this.#actual.delete(a, edgeNode);
    this.#actual.delete(b, edgeNode);
    return true;
  }

  blockNode(node: K): boolean {
    if (this.#blockedNodes.has(node)) {
      return false;
    }
    this.#blockedNodes.add(node);

    // Delete the connection between this node and its edge nodes.
    for (const [, edgeNode] of this.#edgeNodes.otherEntries(node)) {
      this.#actual.delete(node, edgeNode);
    }

    return true;
  }

  *searchByEdge(a: K, b: K): IterableIterator<{ a: K, b: K}> {
    const edgeNode = this.#edgeNodes.get(a, b);
    if (edgeNode === undefined) {
      return;
    }

    for (const n of this.#actual.sharedWith(edgeNode)) {
      if (n instanceof DivisionEdgeNode) {
        yield { a: n.a, b: n.b };
      }
    }
  }

  nodeIsBlocked(node: K): boolean {
    return this.#blockedNodes.has(node);
  }

  unblockNode(node: K): boolean {
    if (!this.#blockedNodes.has(node)) {
      return false;
    }

    // Restore the connections between this node and its edge nodes.
    for (const [, edgeNode] of this.#edgeNodes.otherEntries(node)) {
      this.#actual.add(node, edgeNode);
    }

    this.#blockedNodes.delete(node);
    return true;
  }

}


/**
 * Maintains a {@link DivisionGraph} over a passed {@link TrainGraphEdgeFeed}.
 */
export class DivisionGraphImpl<K> implements DivisionGraph<K> {
  #internal: DivisionComponentGraphInternal<K> | null;

  constructor(tg: TrainGraphEdgeFeed<K>, abort: AbortSignal) {
    if (abort.aborted) {
      this.#internal = null;
      return;
    }
    const i = new DivisionComponentGraphInternal<K>();
    this.#internal = i;

    const handler = (ev: EdgeEvent<K>) => {
      if (ev.length !== 0) {
        i.addEdge(ev.a, ev.b);
      } else {
        i.deleteEdge(ev.a, ev.b);
      }
    };
    tg.addEventListener('edge', handler);

    abort.addEventListener('abort', () => {
      tg.removeEventListener('edge', handler);
      this.#internal = null;
    });

    for (const edge of tg.allEdges()) {
      i.addEdge(edge.a, edge.b);
    }
  }

  addDivision(at: K): boolean {
    return this.#internal?.blockNode(at) ?? false;
  }

  deleteDivision(at: K): boolean {
    return this.#internal?.unblockNode(at) ?? false;
  }

  lookupDivisionByEdge(a: K, b: K): IterableIterator<{ a: K; b: K; }> {
    return this.#internal?.searchByEdge(a, b) ?? [][Symbol.iterator]();
  }

}