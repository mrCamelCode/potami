/**
 * Data structure that combines the benefits of arrays and key-value
 * pairs. The structure can be indexed or keyed.
 */
export class ArrayMap<T> {
  #keys: string[] = [];
  #itemMap: Record<string, T> = {};

  get length(): number {
    return this.#keys.length;
  }

  /**
   * O(1)
   *
   * @param key
   * @returns
   */
  get(key: string): T | undefined {
    return this.#itemMap[key];
  }

  /**
   * O(1)
   *
   * @param index
   * @returns
   */
  at(index: number): T | undefined {
    return this.#itemMap[this.#keys[index]];
  }

  /**
   * O(1)
   *
   * @param index
   * @returns
   */
  keyAt(index: number): string | undefined {
    return this.#keys[index];
  }

  /**
   * O(1)
   *
   * @param key
   * @returns
   */
  has(key: string): boolean {
    return !!this.#itemMap[key];
  }

  /**
   * O(1)
   *
   * @param key
   * @param value
   */
  set(key: string, value: T): void {
    if (this.has(key)) {
      this.#itemMap[key] = value;
    } else {
      this.#itemMap[key] = value;
      this.#keys.push(key);
    }
  }

  /**
   * O(n)
   *
   * If you need to remove multiple keys, it's best to pass them all in
   * instead of removing them with individual calls to `remove`. When removing 
   * multiple keys, via one call, the operation is optimized to O(n), instead 
   * of the O(n * numKeys) you'd get if you called `remove` for each individual key.
   *
   * @param keys
   */
  remove(...keys: string[]): void {
    keys.forEach((key) => {
      delete this.#itemMap[key];
    });

    this.#keys = this.#keys.filter((val) => val in this.#itemMap);
  }

  /**
   * Complexity depends on the runtime's implementation of `Array.prototype.splice`.
   *
   * @param index
   */
  removeAt(index: number): void {
    const key = this.#keys[index];

    if (key) {
      delete this.#itemMap[key];
      this.#keys.splice(index, 1);
    }
  }
}
