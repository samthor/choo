

export interface ComponentGraph<K> {

  /**
   * Adds this node pair to the graph.
   *
   * @return was this pair added (or did it already exist)
   */
  add(a: K, b: K): boolean;

  /**
   * Does the graph have this node pair?
   */
  has(a: K, b: K): boolean;

  /**
   * Delete this node pair.
   *
   * @return was this pair deleted
   */
  delete(a: K, b: K): boolean;

  /**
   * What is the total size of the group containing this nodes?
   */
  groupSize(k: K): number;

  /**
   * Are the passed nodes in the same group?
   */
  sharedGroup(...all: K[]): boolean;

}
