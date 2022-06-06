
/**
 * A set which allows the same value to be added many times.
 */
export class CountSet<T> {
  #m = new Map<T, number>();
  #count = 0;

  total() {
    return this.#count;
  }

  add(t: T): boolean {
    this.#m.set(t, (this.#m.get(t) ?? 0) + 1);
    ++this.#count;
    return true;
  }

  entries() {
    return this.#m.entries();
  }

  delete(t: T): boolean {
    const prev = this.#m.get(t);
    if (prev === undefined) {
      return false;
    }

    if (prev === 1) {
      this.#m.delete(t);
    } else {
      this.#m.set(t, prev - 1);
    }
    --this.#count;
    return true;
  }

  has(t: T): boolean {
    return this.#m.has(t);
  }

  uniques() {
    return this.#m.keys();
  }

  *keys(): IterableIterator<T> {
    for (const [t, count] of this.#m.entries()) {
      for (let i = 0; i < count; ++i) {
        yield t;
      }
    }
  }

}


export class PairSet<K> {
  #m = new PairMap<K, boolean>();

  add(a: K, b: K): boolean {
    return this.#m.set(a, b, true);
  }

  delete(a: K, b: K): boolean {
    return this.#m.delete(a, b);
  }

  has(a: K, b: K): boolean {
    return this.#m.has(a, b);
  }

  *otherKeys(k: K): IterableIterator<K> {
    for (const [key] of this.#m.otherEntries(k)) {
      yield key;
    }
  }

  pairsWith(k: K): number {
    return this.#m.pairsWith(k);
  }

}


/**
 * A map with a pair of keys. Both sides are added at once.
 */
export class PairMap<K, V> {
  #m = new Map<K, Map<K, V>>();

  #implicitGet(k: K) {
    const has = this.#m.get(k);
    if (has !== undefined) {
      return has;
    }
    const update = new Map();
    this.#m.set(k, update);
    return update;
  }

  set(a: K, b: K, v: V): boolean {
    const mapA = this.#implicitGet(a);
    if (mapA.get(b) === v) {
      return false;
    }

    mapA.set(b, v);
    this.#implicitGet(b).set(a, v);
    return true;
  }

  pairsWith(k: K): number {
    return this.#m.get(k)?.size ?? 0;
  }

  otherEntries(k: K): IterableIterator<[K, V]> {
    return this.#m.get(k)?.entries() ?? [][Symbol.iterator]();
  }

  delete(a: K, b: K): boolean {
    const mapA = this.#m.get(a);
    if (!mapA?.has(b)) {
      return false;
    }

    mapA.delete(b);
    if (mapA.size === 0) {
      this.#m.delete(a);
    }

    const mapB = this.#m.get(b)!;
    mapB.delete(a);
    if (mapB.size === 0) {
      this.#m.delete(b);
    }

    return true;
  }

  has(a: K, b: K): boolean {
    return this.#m.get(a)?.has(b) ?? false;
  }

  get(a: K, b: K): V | undefined {
    return this.#m.get(a)?.get(b);
  }
}
