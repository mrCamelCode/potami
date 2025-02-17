import type { Middleware, MiddlewareSubjects } from './model.ts';

/**
 * Provides conveniences for grouping and running middleware.
 */
export class MiddlewareChain {
  #middleware: Middleware[];

  constructor(...middleware: Middleware[]) {
    this.#middleware = middleware;
  }

  add(...middleware: Middleware[]) {
    this.#middleware.push(...middleware);
  }

  /**
   * Runs all the middleware currently registered to this chain
   * in the order they were added. Async middleware will be awaited
   * before moving onto the next middleware.
   *
   * @param subjects - The items the middleware will receive.
   */
  async run(subjects: MiddlewareSubjects): Promise<void | Response> {
    for (const m of this.#middleware) {
      const result = await m(subjects);

      if (result) {
        return result;
      }
    }
  }
}
