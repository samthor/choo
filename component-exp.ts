import { CountSet } from "./helper/maps";


interface NodeData<K> {
  id: K;

  /**
   * Direct parent of this node. Is only undefined for the root node.
   */
  parent: NodeData<K> | undefined;

  children: Set<NodeData<K>>;

  /**
   * Nodes which are not part of the tree structure. Just friends in another branch.
   */
  friend: Set<NodeData<K>>;

  /**
   * Friends which are not contained within this node's family.
   */
  familyFriend: CountSet<NodeData<K>>;
}


/**
 * Represents a distinct tree in a ComponentGraph.
 */
export class ComponentTreeExp<K> {
  #root: K;
  #nodes = new Map<K, NodeData<K>>();

  _nodesForTest() {
    return this.#nodes;
  }

  rootNode() {
    return this.#root;
  }

  parentOf(node: K): K | undefined {
    return this.#nodes.get(node)?.parent?.id;
  }

  nodes() {
    return this.#nodes.keys();
  }

  /**
   * Helper to create parent-attached data.
   */
  #attach(k: K, parent?: K): NodeData<K> {
    let parentData: NodeData<K> | undefined;
    if (parent !== undefined) {
      parentData = this.#nodes.get(parent);
      if (parentData === undefined) {
        throw new Error(`could not get parentData for: ${parent}`);
      }
    }
    const nd: NodeData<K> = {
      id: k,
      parent: parentData,
      children: new Set(),
      friend: new Set(),
      familyFriend: new CountSet(),
    };
    if (this.#nodes.has(k)) {
      throw new Error(`could not create duplicate data: ${k}`);
    }

    parentData?.children.add(nd);

    this.#nodes.set(k, nd);
    return nd;
  }

  constructor(root: K) {
    this.#attach(root);
    this.#root = root;
  }

  /**
   * Add. At least one side must already be part of the tree.
   */
  add(a: K, b: K): boolean {
    let nodeA = this.#nodes.get(a);
    let nodeB = this.#nodes.get(b);

    if (nodeA === undefined && nodeB === undefined) {
      return false;  // can't create
    }

    // TODO: no attempt to balance graph
    if (nodeA === undefined) {
      this.#attach(a, b);
      return true;
    } else if (nodeB === undefined) {
      this.#attach(b, a);
      return true;
    }

    // Otherwise, we're both in the graph already.

    // Check we're not each other's parent. If so, bail early.
    if (nodeA.parent === nodeB || nodeB.parent === nodeA) {
      return false;
    }

    // We're already friends. Bail early.
    if (nodeA.friend.has(nodeB)) {
      if (!nodeB.friend.has(nodeA)) {
        throw new Error(`friendship not reciprocal?`);
      }
      return false;
    }

    // Otherwise create a non-tree direct link.
    nodeA.friend.add(nodeB);
    nodeB.friend.add(nodeA);

    const parentsA = this.#parentsAndSelfFor(nodeA);
    const parentsB = this.#parentsAndSelfFor(nodeB);

    // For every parent of A that isn't common with B, indicate that we can get to B.
    for (const node of parentsA) {
      if (parentsB.has(node) || node === b) {
        break;
      }
      const data = this.#dataFor(node);
      data.familyFriend.add(nodeB);
    }

    // For every parent of B that isn't common with A, indicate that we can get to A.
    for (const node of parentsB) {
      if (parentsA.has(node) || node === a) {
        break;
      }
      const data = this.#dataFor(node);
      data.familyFriend.add(nodeA);
    }

    return true;
  }

  /**
   * Delete. This may create an orphaned set of nodes.
   */
  delete(a: K, b: K): { change: boolean, orphan?: K[] } {
    let nodeA = this.#nodes.get(a);
    let nodeB = this.#nodes.get(b);

    if (nodeA === undefined || nodeB === undefined) {
      return { change: false };  // wasn't in graph
    }

    // Find if this was a parent relation or a "friend" relation.
    if (nodeA.parent === nodeB) {
      const orphan = this.#cutParent(a, b);
      return { change: true, orphan };
    } else if (nodeB.parent === nodeA) {
      const orphan = this.#cutParent(b, a);
      return { change: true, orphan };
    } else if (!nodeB.friend.has(nodeA)) {
      return { change: false };  // wasn't connected
    }

    // This is a friend relation. We'll never orphan nodes but we have work to do.
    // This is simply the reverse of what is done in `add`.

    const parentsA = this.#parentsAndSelfFor(nodeA);
    const parentsB = this.#parentsAndSelfFor(nodeB);

    // For every parent of A that isn't common with B, indicate that we can get to B.
    for (const node of parentsA) {
      if (parentsB.has(node) || node === b) {
        break;
      }
      const data = this.#dataFor(node);
      data.familyFriend.delete(nodeB);
    }

    // For every parent of B that isn't common with A, indicate that we can get to A.
    for (const node of parentsB) {
      if (parentsA.has(node) || node === a) {
        break;
      }
      const data = this.#dataFor(node);
      data.familyFriend.delete(nodeA);
    }

    return { change: true };
  }

  #cutParent(child: K, parent: K): K[] | undefined {
    const parentData = this.#dataFor(parent);
    const childData = this.#dataFor(child);

    // // The parent side will always remain in this tree.
    // childData.parent = undefined;

    // Approach: we have a "familyFriend" set.
    // If it's empty, then there's nothing to be done: us and all our children are orphaned.
    // Create a subtree.
    if (childData.familyFriend.total() === 0) {

      // TODO: this class should support multiple subtrees

      throw new Error(`TODO: got subtree`);
    }

    // If it's not empty, then find any ancestor (including ourselves) which includes one of the set as a friend.
    // This is a set intersection problem - maybe not cheap?
    // Rotate tree around that, rejoin.

    let curr = childData;

    outer:
    for (;;) {
      // TODO: This can be sped up by keeping an intersection of {ff,f} here.
      const k = findCountSetOverlap(curr.familyFriend, curr.friend);
      if (k !== undefined) {
        throw new Error(`TODO: can reparent via ${k.id} on ${curr.id}`)

        parentData.children.delete(childData);
        k.children.add(childData);
        childData.parent = k;

        return undefined;
      }

      // One of these MUST be valid.
      for (const child of curr.children) {
        // TODO: This can be sped up by keeping track of which children have participated in the
        // parent's familyfriends (just a bit on children, or a different set).
        // We just find a child which participates and walk there.
        // XXXX: this could be a thing which indicates [self,...children] participation
        if (findCountSetOverlap(child.familyFriend, curr.familyFriend)) {
          curr = child;

          // TODO: as we walk down this path, rotate the tree - we're moving towards our new local root

          continue outer;
        }
      }

      throw new Error(`could not find child providing familyFriend?`);
    }

    throw new Error(`TODO: connected but need to find new join`);
    return undefined;
  }

  #dataFor(node: K): NodeData<K> {
    const data = this.#nodes.get(node);
    if (data === undefined) {
      throw new Error(`missing nd`);
    }
    return data;
  }

  /**
   * Return all parents of this {@link NodeData}, including the root.
   */
  #parentsAndSelfFor(data: NodeData<K> | undefined): Set<K> {
    const out = new Set<K>();
    if (data !== undefined) {
      while (data) {
        out.add(data.id);
        data = data.parent;
      }
    }
    return out;
  }

}


function findCountSetOverlap<K>(check: CountSet<K>, has: { has(c: K): boolean }): K | undefined {
  for (const c of check.keys()) {
    if (has.has(c)) {
      return c;
    }
  }
}

