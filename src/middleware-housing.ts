import { Middleware } from './model.ts';

/**
 * Provides conveniences for grouping and running middleware.
 */
export class MiddlewareHousing {
  #middleware: Middleware[];

  constructor(...middleware: Middleware[]) {
    this.#middleware = middleware;
  }

  add(...middleware: Middleware[]) {
    this.#middleware.push(...middleware);
  }

  /**
   * Runs all the middleware currently registered to this housing
   * in the order they were added. Async middleware will be awaited
   * before moving onto the next middleware.
   * 
   * @param req - The request all middleware will receive.
   * @param resHeaders - The response headers all middleware will receive.
   * Middleware are free to mutate this as needed.
   */
  async runMiddleware(req: Request, resHeaders: Headers) {
    for (const m of this.#middleware) {
      await m(req, resHeaders);
    }
  }
}
