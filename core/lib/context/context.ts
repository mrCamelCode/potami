export class Context<T = unknown> {
  #id: string;

  get id(): string {
    return this.#id;
  }

  constructor(public readonly defaultValue: T) {
    this.#id = crypto.randomUUID();
  }
}