import { Event } from '../deps.ts';
import { ContextRegistry } from './context/context-registry.ts';
import type { Context } from './context/context.ts';
import type { Controller } from './controller.ts';
import { HttpError } from './errors/http.error.ts';
import { MiddlewareChain } from './middleware-chain.ts';
import type {
  BeforeRespondListener,
  ContextGetter,
  DefaultResponseListener,
  HttpMethod,
  Middleware,
  RequestHandler,
  ServerErrorListener,
} from './model.ts';
import { baseMatchesPath, getRequestPath } from './util.ts';

/**
 * A builder that creates an `HttpServer` instance.
 */
/*
 * Note: This is included because Deno requires all exposed members to be explicitly typed:
 * https://jsr.io/docs/about-slow-types. Therefore, the type of the static `Builder` class
 * can't be inferred, it must be explicitly defined. Because of the hacky way inner classes
 * work with JS, you can't target the type of an inner class with something like `HttpServer.Builder`
 * for TS. So, the only way to be able to explcitly define the type of the builder is to
 * quite literally explicitly define it here and then say that `Builder` is a class that
 * implements this interface.
 *
 * I don't like the fact this means double maintenance every time I want to add something to the
 * builder's exposed members, but Deno/JSR doesn't really give me a lot of options in this
 * case.
 */
export interface HttpServerBuilder {
  build(): HttpServer;
  base(basePath: string): HttpServerBuilder;
  defaultResponseHandler(handler: (req: Request) => Response): HttpServerBuilder;
  entryMiddleware(...middleware: Middleware[]): HttpServerBuilder;
  controller(c: Controller): HttpServerBuilder;
  ssl(sslOptions: Deno.TlsCertifiedKeyPem): HttpServerBuilder;
  errorListeners(...listeners: ServerErrorListener[]): HttpServerBuilder;
  defaultResponseListeners(...listeners: DefaultResponseListener[]): HttpServerBuilder;
  beforeRespondListeners(...listeners: BeforeRespondListener[]): HttpServerBuilder;
}

/**
 * Enables configuring and running a lightweight HTTP server. The server is 
 * configured by chaining configuration methods, and can ultimately
 * be started with the `start` method. Holding onto a reference to the server
 * lets you `stop` it at will as well.
 *
 * This HTTP server has very few opinions, and its primary concern getting
 * a request from ingestion to a function that will handle it and return a
 * response.
 *
 * The server expects you to register controllers with the `controller`
 * method. Controllers hold handlers for requests, and when a request comes
 * into the server, it will try to determine if it has a controller that can
 * handle the request. If it does, the server will send the request through
 * any middleware processing present on that controller and ultimately give 
 * it to the request handler in the controller. The controller returns the 
 * Response it would like the server to respond with, and the server responds 
 * with that Response.
 *
 * The high-level flow through the server can be visualized as:
 * ```txt
 * Client makes request
 *    |
 * Server receives request
 *    |
 * Entry middleware
 *    |
 * Server: Do I have a controller to handle this?
 *    | Yes                                   | No
   Handling controller middleware      Send default response
 *    |
 * Handling controller produces Response
 *    |
 * Server sends produced Response
 *    |
 * Client receives Response
 * ```
 *
 * If you'd like to break from the flow in middleware or even in a request handler
 * to abort further processing because of an issue, it's recommended to throw an
 * error of type `HttpError`. There are several common errors already provided
 * (`BadRequestError`, `ForbiddenError`, etc.) for convenience. The server will catch
 * these errors automatically and respond with the approriate status code. If the
 * server encounters an uncaught error that's _not_ an HttpError, it responds with
 * a 500.
 */
export class HttpServer {
  /**
   * Triggered when the server encounters an uncaught error. This can occur
   * when middleware or a request handler throws an error that it doesn't catch.
   *
   * The server catches all errors and any error that's not a specific
   * error recognized by the server results in a 500 response.
   *
   * Subscribed handlers should not throw.
   */
  onError: Event<ServerErrorListener> = new Event<ServerErrorListener>();
  /**
   * Triggered when the server determines it has no controller to handle the
   * incoming request and is going to send the default response.
   */
  onDefaultResponse: Event<DefaultResponseListener> = new Event<DefaultResponseListener>();
  /**
   * Triggered when the server is about to send a response.
   *
   * Subscribed handlers should not throw.
   */
  onBeforeRespond: Event<BeforeRespondListener> = new Event<BeforeRespondListener>();

  #base?: string;
  #controllers: Controller[] = [];
  #entryMiddlewareChain: MiddlewareChain = new MiddlewareChain();
  #ssl?: Deno.TlsCertifiedKeyPem;
  #httpServer: Deno.HttpServer | undefined;
  #defaultResponseHandler: (req: Request) => Response = () => new Response(undefined, { status: 404 });
  #abortController = new AbortController();

  /**
   * Starts the server on the specified port.
   *
   * @param port - The port to listen on.
   *
   * @returns A promise that resolves once the server has started listening
   * on the specified port.
   */
  start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.#httpServer = Deno.serve(
        {
          port,
          ...this.#ssl,
          signal: this.#abortController.signal,
          onListen: () => {
            resolve();
          },
        },
        this.#handleHttpRequest
      );
    });
  }

  /**
   * Stops the server gracefully. It will no longer receive requests and the port
   * it was listening on will be freed.
   */
  async stop() {
    await this.#httpServer?.shutdown();
  }

  /**
   * Stops the server as quickly as possible. This is less graceful than `stop`, but
   * still frees resources and the port.
   */
  async abort() {
    this.#abortController.abort();
    await this.#httpServer?.finished;
  }

  getHandlingController(path: string): Controller | undefined {
    if (baseMatchesPath(this.#base, path)) {
      return this.#controllers.find((controller) => controller.matchesPath(this.getPathWithoutServerBase(path)));
    }

    return undefined;
  }

  getPathWithoutServerBase(path: string): string {
    return this.#base ? path.replace(this.#base, '') : path;
  }

  #handleHttpRequest: Deno.ServeHandler = async (req, info) => {
    const mutableHeaders = new Headers();
    const contextRegistry = new ContextRegistry();

    let res: Response;
    try {
      const reqPath = getRequestPath(req);

      const entryMiddlewareResult = await this.#entryMiddlewareChain.run({
        req,
        resHeaders: mutableHeaders,
        server: this,
        remoteAddr: info.remoteAddr as Deno.NetAddr,
        getContext: <T>(context: Context<T>): T => {
          return contextRegistry.getContext(context);
        },
        setContext: <T>(context: Context<T>, value: T): void => {
          contextRegistry.register(context, value);
        },
      });

      const { controller, handler, params } = this.#getRequestHandlerDetails(req.method as HttpMethod, reqPath) ?? {};

      if (entryMiddlewareResult) {
        res = entryMiddlewareResult;
      } else if (controller && handler) {
        const controllerScopedContextGetter: ContextGetter = <T>(context: Context<T>): T => {
          return contextRegistry.getContext(context, controller.constructor);
        };

        const controllerMiddlewareResult = await controller.middlewareChain.run({
          req,
          resHeaders: mutableHeaders,
          server: this,
          remoteAddr: info.remoteAddr as Deno.NetAddr,
          getContext: controllerScopedContextGetter,
          setContext: <T>(context: Context<T>, value: T): void => {
            contextRegistry.register(context, value, controller.constructor);
          },
        });

        if (controllerMiddlewareResult) {
          res = controllerMiddlewareResult;
        } else {
          res = await handler({
            req,
            params: params ?? {},
            remoteAddr: info.remoteAddr as Deno.NetAddr,
            getContext: controllerScopedContextGetter,
          });
        }
      } else {
        this.onDefaultResponse.trigger(req);

        res = this.#defaultResponseHandler(req);
      }
    } catch (error) {
      this.onError.trigger(error instanceof Error ? error : new Error(`${error}`));

      res = new Response(undefined, {
        status: error instanceof HttpError ? error.status : 500,
      });
    }

    this.#attachHeadersToResponse(res, mutableHeaders);

    this.onBeforeRespond.trigger(res);

    return res;
  };

  /**
   * @param res - The response to finalize the headers of. This object is mutated.
   * @param headers - The headers that should be included on the response.
   * Any headers the response itself sets will take precedence.
   */
  #attachHeadersToResponse(res: Response, headers: Headers) {
    const finalHeaders = new Headers(Object.fromEntries([...headers.entries(), ...res.headers.entries()]));

    [...res.headers.keys()].map((header) => res.headers.delete(header));
    finalHeaders.forEach((headerValue, headerName) => {
      res.headers.set(headerName, headerValue);
    });
  }

  #getRequestHandlerDetails(
    method: HttpMethod,
    path: string
  ):
    | {
        controller: Controller;
        handler?: RequestHandler;
        params?: Record<string, string>;
      }
    | undefined {
    const controller = this.getHandlingController(path);

    if (controller) {
      const { handler, params } = controller.getRequestHandler(method, this.getPathWithoutServerBase(path)) ?? {};

      return {
        controller,
        handler,
        params,
      };
    }

    return undefined;
  }

  /**
   * Builder class to aid with configuring and building an `HttpServer` instance.
   *
   * **If you're using this for a type annotation**: don't. Use the `HttpServerBuilder` type instead.
   */
  static readonly Builder: { new (): HttpServerBuilder } = class Builder implements HttpServerBuilder {
    #server: HttpServer;

    constructor() {
      this.#server = new HttpServer();
    }

    build(): HttpServer {
      return this.#server;
    }

    /**
     * Sets the server's base path. This is the path that a client must include
     * to talk to the server's controllers. For example, if you set this to `/api`, clients
     * must start their request paths with `/api`, otherwise the server won't
     * send the request to one of its controllers.
     *
     * If this isn't set, there's no required base path to talk to the server's controllers.
     *
     * @param basePath - The base path to use.
     *
     * @returns The builder instance.
     */
    base(basePath: string): this {
      this.#server.#base = basePath;

      return this;
    }

    /**
     * Sets the handler that will be called when the server determines
     * it has no controller that can handle the incoming request.
     *
     * If this isn't set, the default handlder returns a 404 response with no body.
     *
     * @param handler
     *
     * @returns The builder instance.
     */
    defaultResponseHandler(handler: (req: Request) => Response): this {
      this.#server.#defaultResponseHandler = handler;

      return this;
    }

    /**
     * Adds the provided middleware to the entry middleware chain.
     * Entry middleware runs when a request enters the server. It runs before
     * anything else, and runs even if the client's request didn't include
     * the server's `base` (if you provided one).
     *
     * Middleware runs in the order provided. Async middleware is awaited before
     * continuing through the chain.
     *
     * This method is additive and may be called any number of times. Calling
     * it more than once won't remove the middleware from previous invocations,
     * but instead appends the new middleware to the chain.
     *
     * @param middleware - The middleware to add.
     *
     * @returns The builder instance.
     */
    entryMiddleware(...middleware: Middleware[]): this {
      this.#server.#entryMiddlewareChain.add(...middleware);

      return this;
    }

    /**
     * Adds the specified controller to the server. Controllers are the
     * heart of the server and inform it on what requests it can and cannot
     * handle.
     *
     * If a request comes in and the server can't find an appropriate
     * request handler in one of its registered controllers, it will send
     * back the default response.
     *
     * @param c - The controller to add.
     *
     * @returns The builder instance.
     */
    controller(c: Controller): this {
      this.#server.#controllers.push(c);

      return this;
    }

    /**
     * Configures the server to handle HTTPS traffic.
     *
     * @param sslOptions - Object containing parameters to customize how the server manages TLS.
     *
     * @returns The builder instance.
     */
    ssl(sslOptions: Deno.TlsCertifiedKeyPem): this {
      this.#server.#ssl = sslOptions;

      return this;
    }

    /**
     * Subscribes the provided listeners to the server's `onError` event.
     * Invoking this multiple times will append the new listeners to the
     * event's subscriptions.
     *
     * **Listeners for this event should not throw.**
     *
     * @param listeners - The listeners to subscribe.
     *
     * @returns The builder instance.
     */
    errorListeners(...listeners: ServerErrorListener[]): this {
      this.#subscribeListeners(this.#server.onError, ...listeners);

      return this;
    }

    /**
     * Subscribes the provided listeners to the server's `onDefaultResponse` event.
     * Invoking this multiple times will append the new listeners to the
     * event's subscriptions.
     *
     * @param listeners - The listeners to subscribe.
     *
     * @returns The builder instance.
     */
    defaultResponseListeners(...listeners: DefaultResponseListener[]): this {
      this.#subscribeListeners(this.#server.onDefaultResponse, ...listeners);

      return this;
    }

    /**
     * Subscribes the provided listeners to the server's `onBeforeRespond` event.
     * Invoking this multiple times will append the new listeners to the
     * event's subscriptions.
     *
     * **Listeners for this event should not throw.**
     *
     * @param listeners - The listeners to subscribe.
     *
     * @returns The builder instance.
     */
    beforeRespondListeners(...listeners: BeforeRespondListener[]): this {
      this.#subscribeListeners(this.#server.onBeforeRespond, ...listeners);

      return this;
    }

    // deno-lint-ignore no-explicit-any
    #subscribeListeners<T extends (...args: any[]) => void>(event: Event<T>, ...listeners: T[]): void {
      listeners.forEach((listener) => event.subscribe(listener));
    }
  };
}
