
/**
 * A set which allows the same value to be added many times.
 */
export class CountSet<T> {
  #m = new Map<T, number>();
  #count = 0;

  count() {
    return this.#count;
  }

  add(t: T): boolean {
    this.#m.set(t, (this.#m.get(t) ?? 0) + 1);
    ++this.#count;
    return true;
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
