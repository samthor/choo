
/**
 * Train Graph
 *
 *   - Comprised of edges of positive integer length
 *   - These edges join at connection points (ends only)
 *   - Connection points are created implicitly and do not exist without sides
 */


export interface TrainGraph<K, S, D> {

  /**
   * Adds an edge to this graph. Returns true if successful, false if the edge already exists
   * between these two nodes (in either direction).
   */
  addEdge(low: K, high: K, length: number): boolean;

  /**
   * Looks up the edge between these two nodes.
   */
  lookupEdge(a: K, b: K): { length: number, low: K, high: K } | undefined;

  /**
   * Deletes the edge between these two nodes.
   */
  deleteEdge(a: K, b: K): boolean;

  /**
   * Creates a division marker at the given node.
   */
  addDivision(at: K, div: D): void;

  /**
   * Removes a disivion at the given node.
   */
  deleteDivision(at: K, div: D): void;

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
  lookupNode(at: K): { other: Map<K, K[]> };

  /**
   * Adds a slice on the given node. Returns false if it's already on the graph.
   */
  addSlice(id: S, on: K): boolean;

  /**
   * Grows the specified slice by a given integer size (possibly -ve).
   */
  growSlice(id: S, end: -1|1, by: number, where?: (choice: K[]) => K | undefined): number;

  /**
   * Deletes the given slice.
   */
  deleteSlice(id: S): boolean;

  /**
   * Looks up the given slice. Returns the edges that the slice is along with indents. If `along`
   * is single-length, then the slice is a zero slice on the node (and front/back will be zero).
   */
  lookupSlice(id: S): { along: K[], front: number, back: number, length: number } | undefined;

  /**
   * Queries the space under this slice. Includes all other slices found (including itself if wrap).
   */
  querySlice(id: S): { other: K[] };

}