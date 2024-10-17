import type { BaseRequestContext, DefaultRequestContext, Middleware, MiddlewareSubjects } from './model.ts';

/**
 * Provides conveniences for grouping and running middleware.
 */
export class MiddlewareChain<RequestContext extends BaseRequestContext = DefaultRequestContext> {
  #middleware: Middleware<RequestContext>[];

  constructor(...middleware: Middleware<RequestContext>[]) {
    this.#middleware = middleware;
  }

  add(...middleware: Middleware<RequestContext>[]) {
    this.#middleware.push(...middleware);
  }

  /**
   * Runs all the middleware currently registered to this chain
   * in the order they were added. Async middleware will be awaited
   * before moving onto the next middleware.
   *
   * @param subjects - The items the middleware will receive.
   */
  async run(subjects: MiddlewareSubjects<RequestContext>): Promise<void | Response> {
    for (const m of this.#middleware) {
      const result = await m(subjects);

      if (result) {
        return result;
      }
    }
  }
}
