import { MiddlewareHousing } from './middleware-housing.ts';
import { ControllerOptions, HttpMethod, RequestHandler } from './model.ts';
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
 *  'GET /users': RequestHandler = (req) => {...};
 *  'GET /users/:userId': RequestHandler = (req, params) => {...};
 *  'GET /users/:userId/messages/:messageId': RequestHandler = (req, { userId, messageId }) => {...};
 *
 *  'POST /users/new': RequestHandler = (req) => {...};
 * }
 * ```
 * While request handlers must be named very precisely, you're free to
 * have any other methods or members you find useful on your controller
 * such as references to service classes, helper methods, constants, etc.
 * The only opinion as it pertains to how you write your Controllers is
 * the naming convention for the request handling methods.
 */
export abstract class Controller {
  static readonly #handlerNamePattern = new RegExp(`^(${Object.values(HttpMethod).join('|')}) .+$`);

  #base: string;
  #middleware?: MiddlewareHousing;

  constructor({ base, middleware }: ControllerOptions) {
    this.#base = base;
    this.#middleware = new MiddlewareHousing(...(middleware ?? []));
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
   * @param path - The path. May optionally contain the base path of the controller.
   * Must start with a /.
   *
   * @returns The handler for the path, or `undefined` if the controller has no suitable
   * handler.
   */
  getRequestHandler(
    method: HttpMethod,
    path: string
  ): { handler: RequestHandler; params?: Record<string, string> } | undefined {
    const treatPath = (str: string) => {
      const pathWithoutBase = baseMatchesPath(this.#base, str) ? str.replace(this.#base, '') : str;
      const pathWithLeadingSlash = pathWithoutBase.startsWith('/') ? pathWithoutBase : `/${pathWithoutBase}`;

      return pathWithLeadingSlash.length > 1 && pathWithLeadingSlash.endsWith('/')
        ? pathWithLeadingSlash.substring(0, pathWithLeadingSlash.length - 1)
        : pathWithLeadingSlash;
    };

    const treatedPath = treatPath(path);

    const handlerNames = this.#getHandlerNames();

    const possibleHandlersByMethod = handlerNames.filter((handlerName) => {
      const [handlerMethod] = handlerName.split(' ');

      return handlerMethod === method;
    });

    if (possibleHandlersByMethod.length > 0) {
      const treatedPathParts = getPathParts(treatedPath);

      const matchingHandlerName = possibleHandlersByMethod.find((handlerName) => {
        const [, handlerPath] = handlerName.split(' ');

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

      if (matchingHandlerName) {
        const handler = this[matchingHandlerName as keyof this] as RequestHandler;
        const params = this.#getRouteParams(treatedPath, matchingHandlerName.split(' ')[1]);

        return {
          handler,
          params,
        };
      }
    }

    return undefined;
  }

  /**
   * @param path - The path to test. Note that this path should start
   * with a leading /.
   *
   * @returns Whether the path matches this controller's base path. This
   * tells you whether this controller can _potentially_ handle the path.
   * To know whether it can produce a response for the path, use
   * {@link getRequestHandler}.
   */
  matchesPath(path: string): boolean {
    return baseMatchesPath(this.#base, path);
  }

  async runMiddleware(req: Request, resHeaders: Headers): Promise<void> {
    await this.#middleware?.runMiddleware(req, resHeaders);
  }

  /**
   * Convenience method that calls {@link Controller.getSearchParams}.
   */
  protected getSearchParams(req: Request): URLSearchParams {
    return Controller.getSearchParams(req);
  }

  #getHandlerNames(): string[] {
    return Object.getOwnPropertyNames(this).filter((methodName) => Controller.#handlerNamePattern.test(methodName));
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
}
