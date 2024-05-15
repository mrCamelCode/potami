/**
 * A function that receives the request currently being processed, and
 * a mutable reference to response headers. The middleware is free to
 * mutate the response headers as needed. In the case where two middleware
 * mutate the same header, the middleware that mutated last is the one that
 * takes precedence.
 */
export type Middleware = (req: Request, resHeaders: Headers) => void | Promise<void>;

/**
 * A function that receives the current request and the route params,
 * if relevant. Request handlers return a Response that's ultimately
 * sent back to the client by the server.
 */
export type RequestHandler = (req: Request, routeParams?: Record<string, string>) => Response | Promise<Response>;

/**
 * Handler for when the server experiences an error.
 * Receives the error that happened.
 */
export type ServerErrorHandler = (err: Error) => void;
/**
 * Handler for when the server is going to send the default response.
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
   * AFTER global middleware, but before the designated request handler
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
