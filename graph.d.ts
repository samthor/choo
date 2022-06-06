
/**
 * Train Graph
 *
 *   - Comprised of edges of positive integer length
 *   - These edges join at connection points (ends only)
 *   - Connection points are created implicitly and do not exist without sides
 */


export interface DescribedSlice<K, S> {
  along: K[];
  front: number;
  back: number;
  length: number;
}


export interface TrainGraph<K, S> {

  /**
   * Adds an edge to this graph. Returns true if successful, false if the edge already exists
   * between these two nodes (in either direction).
   */
  addEdge(low: K, high: K, length: number): boolean;

  /**
   * Looks up the edge between these two nodes.
   */
  lookupEdge(a: K, b: K): { length: number, low: K, high: K, slices: S[] } | undefined;

  /**
   * Deletes the edge between these two nodes.
   */
  deleteEdge(a: K, b: K): boolean;

  /**
   * Adds a connection from a->b through the passed node.
   */
  connect(a: K, through: K, b: K): boolean;

  /**
   * Removes a connection from a->b via the passed node.
   */
  disconnect(a: K, through: K, b: K): boolean;

  /**
   * Return the edges and connections at this node.
   */
  lookupNode(at: K): { other: Map<K, K[]>, slices: S[] };

  /**
   * Adds a slice on the given node. Returns false if it's already on the graph.
   */
  addSlice(id: S, on: K): boolean;

  /**
   * Grows the specified slice by a given integer size (possibly -ve).
   */
  modifySlice(id: S, end: -1 | 1, by: number, where?: (choice: K[]) => K | undefined): number;

  /**
   * Deletes the given slice.
   */
  deleteSlice(id: S): boolean;

  /**
   * Looks up the given slice. Returns the edges that the slice is along with indents. If `along`
   * is single-length, then the slice is a zero slice on the node (and front/back will be zero).
   */
  lookupSlice(id: S): DescribedSlice<K, S> | undefined;

  /**
   * Queries the space under this slice. Includes all other slices found (including itself if wrap).
   */
  querySlice(id: S): { other: K[] };

}


export interface EdgeEvent<K> extends Event {
  readonly a: K;
  readonly b: K;
  readonly length: number;
}


export interface TrainGraphEdgeFeed<K> extends EventTarget {

  /**
   * Enumerate through all edges. Modifying the set of edges during this call has undefined behavior.
   */
  allEdges(): IterableIterator<{ a: K, b: K, length: number }>;

  /**
   * Listener for edge changes.
   */
  addEventListener<K extends 'edge'>(type: K, listener: (this: TrainGraphEdgeFeed<K>, ev: EdgeEvent) => any, options?: boolean | AddEventListenerOptions): void;

  removeEventListener<K extends 'edge'>(type: K, listener: (this: TrainGraphEdgeFeed<K>, ev: EdgeEvent) => any);

}



export interface DivisionGraph<K> {

  /**
   * Creates a division marker at the given node.
   */
  addDivision(at: K): boolean;

  /**
   * Removes a division marker at the given node.
   */
  deleteDivision(at: K): boolean;

  /**
   * Lookup all nodes that share this division.
   */
  lookupDivisionByEdge(a: K, b: K): Iterable<{ a: K, b: K }>;

}


