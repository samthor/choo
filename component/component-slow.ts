import { PairSet } from '../helper/maps';
import { ComponentGraph } from './component';


/**
 * An inefficient component graph. Does not handle removals well as it must search both sides to
 * determine the possible outcome (split or remain).
 * 
 * A component graph identifies components that are not connected to other parts of a graph.
 *
 * Apparently this is a hard (although possibly somewhat solved) problem. The best approach creates
 * spanning trees across each disconnected graph, creates a Euler tour over each tree, and uses
 * some magic weighting stuff to aggregate "less general" parts of the graph.
 *
 * @see https://en.wikipedia.org/wiki/Component_(graph_theory)
 * @see https://en.wikipedia.org/wiki/Dynamic_connectivity
 */
export class ComponentGraphSlowImpl<K> implements ComponentGraph<K> {

  groupSize(k: K): number {
    const div = this.#comp.get(k);
    return div?.all.size ?? 1;
  }

  sharedGroup(...all: K[]): boolean {
    if (all.length <= 1) {
      return true;  // only one, always with itself
    }

    const expected = this.#comp.get(all[0]);
    if (expected === undefined) {
      return false;  // not in graph, can't share with others
    }

    for (let i = 1; i < all.length; ++i) {
      const other = this.#comp.get(all[i]);
      if (other !== expected) {
        return false;
      }
    }

    return true;
  }

  #pairs = new PairSet<K>();
  #comp = new Map<K, { all: Set<K> }>();

  add(a: K, b: K): boolean {
    if (!this.#pairs.add(a, b)) {
      return false;
    }

    // find divisions of both sides
    const divA = this.#comp.get(a);
    const divB = this.#comp.get(b);

    if (divA === undefined && divB === undefined) {
      // Create brand new division.
      const div = { __div: `div-${Math.random()}`, all: new Set<K>([a, b]) };
      this.#comp.set(a, div);
      this.#comp.set(b, div);

    } else if (divA === divB) {
      // Do nothing. Part of the same division already.

    } else if (divA === undefined) {
      // divB is already a division, join it.
      divB!.all.add(a);
      this.#comp.set(a, divB!);

    } else if (divB === undefined) {
      // divA is already a division, join it.
      divA!.all.add(b);
      this.#comp.set(b, divA!);

    } else {
      // These are different divisions. The biggest division will win.
      const [win, lose] = divA.all.size > divB.all.size ? [divA, divB] : [divB, divA];

      for (const k of lose.all) {
        win.all.add(k);
        this.#comp.set(k, win);
      }
    }

    return true;
  }

  has(a: K, b: K): boolean {
    return this.#pairs.has(a, b);
  }

  delete(a: K, b: K): boolean {
    if (!this.#pairs.delete(a, b)) {
      return false;
    }

    const aPairs = this.#pairs.pairsWith(a);
    const bPairs = this.#pairs.pairsWith(b);

    // See if either side is now an orphan, and bail out early if so.
    let doneEarly = false;
    if (aPairs === 0) {
      this.#comp.delete(a);
      doneEarly = true;
    }
    if (bPairs === 0) {
      this.#comp.delete(b);
      doneEarly = true;
    }
    if (doneEarly) {
      return true;
    }

    // Otherwise, do a very slow search: we have to expand all nodes on both sides to find out if
    // there's any remaining overlap. We randomly pick "A" to expand fully first.
    const setA = new Set(this.#from(a));
    const setB = new Set<K>();
    for (const check of this.#from(b)) {
      if (setA.has(check)) {
        // found overlap, do nothing
        return true;
      }
      setB.add(check);
    }

    // Split out the smaller side!
    const split = setA.size > setB.size ? setB : setA;

    const formerDiv = this.#comp.get(a)!;  // all same div
    const div = { __div: `div-split-${Math.random()}`, all: new Set<K>(split) };
    for (const s of split) {
      formerDiv.all.delete(s);
      this.#comp.set(s, div);
    }

    return true;
  }

  /**
   * Return all unique keys that share the same division, including the passed key.
   */
  sharedWith(k: K): IterableIterator<K> {
    const div = this.#comp.get(k);
    if (div === undefined) {
      return [k][Symbol.iterator]();
    }
    return div.all.keys();
  }

  /**
   * Searches from the specified key. All entries will be in the same division, but this is used by
   * the deletion process.
   */
  *#from(k: K) {
    const pending = [k];
    const seen = new Set<K>(pending);

    for (;;) {
      const next = pending.shift();
      if (next === undefined) {
        break;
      }
      yield next;

      const others = [...this.#pairs.otherKeys(next)];
      for (const other of others) {
        if (seen.has(other)) {
          continue;
        }
        seen.add(other);
        pending.push(other);
      }
    }
  }

}