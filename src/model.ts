import { HttpServer } from './http-server.ts';
import { MaybePromise } from './types.ts';

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
export type Middleware = (middlewareSubjects: MiddlewareSubjects) => MaybePromise<Response | void>;
export interface MiddlewareSubjects {
  /**
   * The current request being handled.
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
   * An immutable reference to the server instance. Attempting to mutate
   * this object will result in an error.
   *
   * Useful for fancy stuff when you know what you're doing.
   */
  readonly server: HttpServer;
}

/**
 * A function that receives the current request and the route params,
 * if relevant. Request handlers return a Response that's ultimately
 * sent back to the client by the server.
 */
export type RequestHandler = (req: Request, routeParams: Record<string, string>) => MaybePromise<Response>;

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
 * Base options common to all controllers.
 */
export interface ControllerOptions {
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
  middleware?: Middleware[];
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
