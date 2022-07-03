import { CountSet } from '../helper/maps';
import { ComponentGraph } from './component';


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
 * Provides component information on a graph.
 */
export class ComponentTreeExp<K> implements ComponentGraph<K> {

  has(a: K, b: K): boolean {
    throw new Error('Method not implemented.');
  }

  groupSize(k: K): number {
    throw new Error('Method not implemented.');
  }

  sharedGroup(...all: K[]): boolean {
    throw new Error('Method not implemented.');
  }

  #roots = new Set<NodeData<K>>();
  #nodes = new Map<K, NodeData<K>>();

  _nodesForTest() {
    return this.#nodes;
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

  /**
   * Add. If neither is in tree then the first argument is used as a root.
   */
  add(a: K, b: K): boolean {
    let nodeA = this.#nodes.get(a);
    let nodeB = this.#nodes.get(b);

    if (nodeA === undefined && nodeB === undefined) {
      nodeA = this.#attach(a);
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

    // TODO: could compute this slightly more efficiently (just get one, compare tree).
    const parentsA = this.#parentsAndSelfFor(nodeA);
    const parentsB = this.#parentsAndSelfFor(nodeB);

    // Check we're in the same root. If not then add another way.
    if (parentsA.at(-1) !== parentsB.at(-1)) {
      // Find the shortest stack (least rotation) and attach that to the largest stack.
      throw new Error(`TODO: do the least rotation and attach`);
    }

    // Otherwise create a non-tree direct link.
    nodeA.friend.add(nodeB);
    nodeB.friend.add(nodeA);

    // For every parent of A that isn't common with B, indicate that we can get to B.
    for (const node of parentsA) {
      if (parentsB.includes(node) || node === b) {
        break;
      }
      const data = this.#dataFor(node);
      data.familyFriend.add(nodeB);
    }

    // For every parent of B that isn't common with A, indicate that we can get to A.
    for (const node of parentsB) {
      if (parentsA.includes(node) || node === a) {
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
  delete(a: K, b: K): boolean {
    let nodeA = this.#nodes.get(a);
    let nodeB = this.#nodes.get(b);

    if (nodeA === undefined || nodeB === undefined) {
      return false;
    }

    // Find if this was a parent relation or a "friend" relation.
    if (nodeA.parent === nodeB) {
      this.#cutParent(a, b);
      return true;
    } else if (nodeB.parent === nodeA) {
      this.#cutParent(b, a);
      return true;
    } else if (!nodeB.friend.has(nodeA)) {
      return false;  // wasn't connected
    }

    nodeA.friend.delete(nodeB);
    nodeB.friend.delete(nodeA);

    // This is a friend relation. We'll never orphan nodes but we have work to do.
    // This is simply the reverse of what is done in `add`.

    const parentsA = this.#parentsAndSelfFor(nodeA);
    const parentsB = this.#parentsAndSelfFor(nodeB);

    // For every parent of A that isn't common with B, indicate that we can get to B.
    for (const node of parentsA) {
      if (parentsB.includes(node) || node === b) {
        break;
      }
      const data = this.#dataFor(node);
      data.familyFriend.delete(nodeB);
    }

    // For every parent of B that isn't common with A, indicate that we can get to A.
    for (const node of parentsB) {
      if (parentsA.includes(node) || node === a) {
        break;
      }
      const data = this.#dataFor(node);
      data.familyFriend.delete(nodeA);
    }

    return true;
  }

  #cutParent(child: K, parent: K): void {
    const parentData = this.#dataFor(parent);
    const childData = this.#dataFor(child);

    // // The parent side will always remain in this tree.
    // childData.parent = undefined;

    // Approach: we have a "familyFriend" set.
    // If it's empty, then there's nothing to be done: us and all our children are orphaned.
    // Create a subtree.
    if (childData.familyFriend.total() === 0) {
      parentData.children.delete(childData);
      childData.parent = undefined;
      this.#roots.add(childData);

      // TODO: clear empties?
      return;
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

    throw new Error(`Should never get here`);
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
  #parentsAndSelfFor(data: NodeData<K> | undefined): K[] {
    const out: K[] = [];
    if (data !== undefined) {
      while (data) {
        out.push(data.id);
        data = data.parent;
      }
    }
    return out;
  }

  /**
   * Makes the specified node the root of its tree.
   */
  makeRoot(node: K) {
    const nodeData = this.#nodes.get(node);
    if (!nodeData) {
      return;
    }

    const chain = this.#parentsAndSelfFor(nodeData).map((id) => this.#nodes.get(id)!);
    chain.reverse();

    while (chain.length > 1) {
      const previousRoot = chain.shift()!;
      const newRoot = chain[0];

      previousRoot.parent = newRoot;
      newRoot.parent = undefined;

      // TODO: fix ff on both

//      throw new Error(`can't rotate`);
    }

  }

  /**
   * Rotate the specified root node to its listed child.
   */
  #rotateRoot(rootNode: NodeData<K>, child: K) {
    throw new Error(`TODO: hard`);
  }

}


function findCountSetOverlap<K>(check: CountSet<K>, has: { has(c: K): boolean }): K | undefined {
  for (const c of check.keys()) {
    if (has.has(c)) {
      return c;
    }
  }
}

