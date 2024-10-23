import type { HttpServer } from './http-server.ts';
import type { MaybePromise } from './types.ts';

export type DefaultRequestContext = Record<string, never>;
export type BaseRequestContext = { [key: string]: unknown };

/**
 * A function that runs against a series of subjects. The subjects include (but are
 * not limited to): the request currently being processed, and a mutable reference
 * to response headers.
 *
 * Middleware may optionally return a `Response`. If a middleware generates a `Response`,
 * further processing is abandoned and the server will respond with the provided `Response`
 * after attaching any headers that were added from other middleware that ran before.
 *
 * Returning a response from middleware can be useful when you need to handle requests
 * that don't necessarily correspond to a path (like an `Upgrade` request), or when
 * you need to report on information about the server for arbitrary paths (like determining
 * the response to an OPTIONS request).
 */
export type Middleware<RequestContext extends BaseRequestContext = DefaultRequestContext> = (
  middlewareSubjects: MiddlewareSubjects<RequestContext>
) => MaybePromise<Response | void>;

export interface Contextual<RequestContext extends BaseRequestContext = DefaultRequestContext> {
  /**
   * Contextual information about the current request. This object is empty by default, but is open to mutation should
   * you want to put information here. It's recommended you take advantage of typing to statically type this object
   * for code quality instead of arbitrarily populating this object with data.
   * 
   * The reference to `ctx` should remain stable for the lifetime of a request. **DO NOT** change
   * the `ctx` object itself. Update `ctx` by setting properties on it.
   *
   * Some Potami modules may populate this object with properties for you to use. If a first-party module does this,
   * it will be made clear via its documentation that it adds something to the context. Additionally, it will provide a
   * type you can use to extend your app's context type to keep the context object strongly typed.
   *
   * In general, your type for the context should treat all properties as optional as the context is populated on an
   * as-needed basis and may only be populated after a certain point in the request -> response flow. Assuming the property
   * may be undefined at any point will result in more robust code.
   *
   * The major parts of Potami (middleware, middleware chains, controllers, and HTTP servers) are all generic to allow
   * you to define the request context shape your app uses. These generic type arguments are optional, and default to
   * an empty object. If you make use of context in your application, it's recommended to define some helper types
   * to ease development and keep your types strong:
   *
   * @example Basic setup with context
   * ```ts
   * import { type Middleware, type RequestHandler, Controller, HttpServer } from '@potami/core';
   *
   * type User = { name: string; email: string };
   * type AuthContext = { user?: User };
   * type Session = { id: string };
   * type SessionContext = { session?: Session };
   *
   * type AppRequestContext = AuthContext & SessionContext;
   * type AppMiddleware = Middleware<AppRequestContext>;
   * const AppController = Controller<AppRequestContext>;
   * type AppRequestHandler = RequestHandler<AppRequestContext>;
   *
   * // When defining middleware:
   * const myMiddleware: AppMiddleware = ({ ctx }) => {
   *   console.log(`user name is ${ctx.user?.name ?? 'User not initialized'}`);
   * };
   *
   * // When defining controllers and their request handlers:
   * class HelloController extends AppController {
   *   constructor() {
   *     super({ base: '/hello' });
   *   }
   *
   *   'GET /': AppRequestHandler = ({ ctx }) => {
   *     console.log(`session id is ${ctx.session?.id ?? 'Session not initialized'}`);
   *
   *     return new Response();
   *   };
   * }
   *
   * // When bootstrapping your server:
   * const server = new HttpServer<AppRequestContext>();
   * server.entryMiddleware(myMiddleware).controller(new HelloController()).start(3000);
   * ```
   * 
   * @example Updating the context
   * ```ts
   * // !!INCORRECT: DO NOT DO IT THIS WAY!!
   * const veryBadMiddleware: AppMiddleware = (subjects) => {
   *    subjects.ctx = { user: { name: 'Person' }};
   * };
   * 
   * // CORRECT: do it this way!
   * const goodMiddleware: AppMiddleware = ({ ctx }) => {
   *    ctx.user.name = 'Person';
   *    // Or:
   *    ctx.user = { name: 'Person' };
   *    // Or (if you don't like destructuring and you didn't destructure):
   *    subjects.ctx.user.name = 'Person';
   * 
   *    // The important thing here is you're NOT modifying the reference to
   *    // the `ctx` object. It should remain stable throughout the lifetime
   *    // of the request.
   * };
   * ```
   */
  ctx: RequestContext;
}

export interface MiddlewareSubjects<RequestContext extends BaseRequestContext = DefaultRequestContext>
  extends Contextual<RequestContext> {
  /**
   * The current request being handled. Avoid mutating the request. If you need to store some
   * information in a per-request location, use the `ctx` instead.
   */
  req: Request;
  /**
   * Mutable response headers. These headers will be present on the response
   * that's eventually sent.
   *
   * If multiple middleware touch the same header, the last applied value
   * takes precedence.
   */
  resHeaders: Headers;
  /**
   * A reference to the server instance. **DO NOT MUTATE THE SERVER.**
   *
   * Useful for fancy stuff when you know what you're doing.
   */
  readonly server: HttpServer<RequestContext>;
}

export interface RequestHandlerSubjects<RequestContext extends BaseRequestContext = DefaultRequestContext>
  extends Contextual<RequestContext> {
  req: Request;
  params: Record<string, string>;
}

/**
 * A function that receives the current request and the route params,
 * if relevant. Request handlers return a Response that's ultimately
 * sent back to the client by the server.
 */
export type RequestHandler<RequestContext extends BaseRequestContext = DefaultRequestContext> = (
  subjects: RequestHandlerSubjects<RequestContext>
) => MaybePromise<Response>;

/**
 * Handler for when the server experiences an error.
 *
 * Receives the error that happened.
 */
export type ServerErrorHandler = (err: Error) => void;
/**
 * Handler for when the server is going to send the default response.
 *
 * Receives the request currently being processed.
 */
export type DefaultResponseHandler = (req: Request) => void;
/**
 * Handler for when the server is about to send the provided response.
 */
export type BeforeRespondHandler = (res: Response) => void;

/**
 * Base options common to all controllers.
 */
export interface ControllerOptions<RequestContext extends BaseRequestContext = DefaultRequestContext> {
  /**
   * The base path of the controller. Must start with a `/`. This path
   * is used to differentiate the controller from every other controller
   * registered to the server. The string should be unique among other
   * controllers.
   */
  base: string;
  /**
   * Middleware for the controller. These middleware run ONLY when this
   * controller is going to handle the request. Controller middleware runs
   * AFTER entry middleware, but before the designated `RequestHandler`
   * generates its response.
   *
   * Useful for doing something whenever a request "enters" this
   * specific controller.
   */
  middleware?: Middleware<RequestContext>[];
}

/**
 * Convenience enum for all valid HTTP methods.
 */
export enum HttpMethod {
  Get = 'GET',
  Put = 'PUT',
  Post = 'POST',
  Head = 'HEAD',
  Delete = 'DELETE',
  Connect = 'CONNECT',
  Options = 'OPTIONS',
  Trace = 'TRACE',
  Patch = 'PATCH',
}
