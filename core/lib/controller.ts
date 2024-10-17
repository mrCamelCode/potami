import { MiddlewareChain } from './middleware-chain.ts';
import { type ControllerOptions, type BaseRequestContext, HttpMethod, type RequestHandler, type DefaultRequestContext } from './model.ts';
import { baseMatchesPath, getPathParts } from './util.ts';

/**
 * Abstract class that your controllers must extend. A controller contains
 * request handlers that inform the server on what requests it can handle.
 *
 * Request handlers follow a very specific naming convention that keeps
 * the path they can handle very obvious at a glance. They also double as
 * routing so the server understands paths.
 *
 * Request handlers are named in the format `{method} {path}`.
 *
 * `method` **must** be a valid HTTP method in all caps.
 *
 * `path` **must** start with a `/`, and can optionally contain route params. The
 * request handler will receive these params (if present) as a param.
 *
 * @example
 * ```ts
 * class UserController extends Controller {
 *  constructor() {
 *    // Setting your base here isn't required. Feel free to expose the
 *    // ControllerOptions via this constructor and allow something else
 *    // to control those details of the controller.
 *    super({ base: '/users' });
 *  }
 *
 *  'GET /users': RequestHandler = ({req}) => {...};
 *  'GET /users/:userId': RequestHandler = ({req, params}) => {...};
 *  'GET /users/:userId/messages/:messageId': RequestHandler = ({req, params: { userId, messageId }}) => {...};
 *
 *  'POST /users/new': RequestHandler = ({req}) => {...};
 * }
 * ```
 * While request handlers must be named very precisely, you're free to
 * have any other methods or members you find useful on your controller
 * such as references to service classes, helper methods, constants, etc.
 * The only opinion as it pertains to how you write your Controllers is
 * the naming convention for the request handling methods.
 */
export abstract class Controller<RequestContext extends BaseRequestContext = DefaultRequestContext> {
  static readonly #HANDLER_NAME_PATTERN = new RegExp(`^(${Object.values(HttpMethod).join('|')}) .+$`);

  #base: string;
  #middlewareChain: MiddlewareChain<RequestContext> = new MiddlewareChain();

  /**
   * A readonly version of the controller's middleware chain.
   *
   * **Do not mutate the chain.**
   */
  public get middlewareChain(): MiddlewareChain<RequestContext> {
    return this.#middlewareChain;
  }

  constructor({ base, middleware }: ControllerOptions<RequestContext>) {
    this.#base = base;
    this.#middlewareChain = new MiddlewareChain(...(middleware ?? []));
  }

  /**
   * @param req - The request to pull the search params from.
   *
   * @returns The search params on the provided `req`.
   */
  public static getSearchParams(req: Request): URLSearchParams {
    return new URL(req.url).searchParams;
  }

  /**
   * @param requestHandlerName
   *
   * @returns The parts of the `RequestHandler`'s name: the method and path.
   * `undefined` if the provided string isn't in the expected format of a
   * `RequestHandler` name.
   */
  public static getRequestHandlerNameParts(
    requestHandlerName: string
  ): { method: HttpMethod; path: string } | undefined {
    if (Controller.#HANDLER_NAME_PATTERN.test(requestHandlerName)) {
      const [method, path] = requestHandlerName.split(' ');

      return {
        method: method as HttpMethod,
        path,
      };
    }

    return undefined;
  }

  /**
   * @param path - The path. May optionally contain the base path of the controller.
   * Must start with a /.
   *
   * @returns The handler for the path, or `undefined` if the controller has no suitable
   * handler.
   */
  getRequestHandler(
    method: HttpMethod,
    path: string
  ): { handler: RequestHandler<RequestContext>; params?: Record<string, string> } | undefined {
    const matchingHandlerName = this.getRequestHandlerNamesForPath(path).find(
      (handlerName) => Controller.getRequestHandlerNameParts(handlerName)?.method === method
    );

    if (matchingHandlerName) {
      const handler = this[matchingHandlerName as keyof this] as RequestHandler<RequestContext>;
      const params = this.#getRouteParams(
        this.#treatPath(path),
        Controller.getRequestHandlerNameParts(matchingHandlerName)!.path
      );

      return {
        handler,
        params,
      };
    }

    return undefined;
  }

  /**
   * @param path - The path WITHOUT any server-level base in it. The path may
   * contain the controller's base path.
   *
   * @returns The names of the request handlers that qualify to handle the provided
   * `path`.
   */
  getRequestHandlerNamesForPath(path: string): string[] {
    const treatedPath = this.#treatPath(path);

    const handlerNames = this.#getAllRequestHandlerNames();

    const treatedPathParts = getPathParts(treatedPath);

    return handlerNames.filter((handlerName) => {
      const { path: handlerPath } = Controller.getRequestHandlerNameParts(handlerName)!;

      const handlerPathParts = getPathParts(handlerPath);

      return (
        treatedPathParts.length === handlerPathParts.length &&
        treatedPathParts.every((treatedPathPart, index) => {
          const handlerPathPart = handlerPathParts[index];

          return (
            handlerPathPart === treatedPathPart ||
            // Route params in the handler are like wildcards and match on anything
            // as long as it's not an empty string.
            (handlerPathPart.startsWith(':') && treatedPathPart)
          );
        })
      );
    });
  }

  /**
   * @param path - The path to test. Note that this path should start
   * with a leading /.
   *
   * @returns Whether the path matches this controller's base path. This
   * tells you whether this controller can _potentially_ handle the path.
   * To know whether it can produce a response for the path, use
   * `getRequestHandler`.
   */
  matchesPath(path: string): boolean {
    return baseMatchesPath(this.#base, path);
  }

  /**
   * Convenience method that calls {@link Controller.getSearchParams}.
   */
  protected getSearchParams(req: Request): URLSearchParams {
    return Controller.getSearchParams(req);
  }

  #getAllRequestHandlerNames(): string[] {
    return Object.getOwnPropertyNames(this).filter((methodName) => Controller.#HANDLER_NAME_PATTERN.test(methodName));
  }

  /**
   * @param path - The received path, properly treated to only include
   * the part describing the controller path. For example, if getting the route
   * params for a request handler `GET /users/:userId`, this string should be
   * `/users/123`.
   * @param handlerPath - The path of the handler. This is the name of the request
   * handler without the HTTP method.
   *
   * @returns An object representing the params substituted from `path`.
   *
   * @example
   * ```ts
   * this.#getRouteParams('/users/123/messages/321', '/users/:userId/messages/:messageId'); // => { userId: '123', messageId: '321' }
   * ```
   */
  #getRouteParams(path: string, handlerPath: string): Record<string, string> {
    const pathParts = getPathParts(path);
    const handlerPathParts = getPathParts(handlerPath);

    const params: Record<string, string> = {};
    handlerPathParts.forEach((part, index) => {
      if (part.startsWith(':')) {
        const routeParamName = part.substring(1);

        params[routeParamName] = pathParts[index];
      }
    });

    return params;
  }

  /**
   * @param path
   * @returns The path without the controller's base path and with a leading slash.
   * This version of the path is intended to match the path that would be
   * included in a `RequestHandler`'s name.
   */
  #treatPath(path: string): string {
    const pathWithoutBase = baseMatchesPath(this.#base, path) ? path.replace(this.#base, '') : path;
    const pathWithLeadingSlash = pathWithoutBase.startsWith('/') ? pathWithoutBase : `/${pathWithoutBase}`;

    return pathWithLeadingSlash.length > 1 && pathWithLeadingSlash.endsWith('/')
      ? pathWithLeadingSlash.substring(0, pathWithLeadingSlash.length - 1)
      : pathWithLeadingSlash;
  }
}
