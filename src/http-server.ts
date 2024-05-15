import { Controller } from './controller.ts';
import { Event } from './deps.ts';
import { HttpError } from './errors/http.error.ts';
import { MiddlewareHousing } from './middleware-housing.ts';
import { DefaultResponseHandler, HttpMethod, Middleware, RequestHandler, ServerErrorHandler } from './model.ts';
import { baseMatchesPath } from './util.ts';

/**
 * Enables configuring and running a lightweight HTTP server. The server
 * can be configured with its methods that allow chaining, and can ultimately
 * be started with the `start` method. Holding onto a reference to the
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
 * middleware processing and ultimately give it to the request handler in the
 * controller. The controller returns the Response it would like the server
 * to respond with, and the server responds with that Response.
 *
 * The high-level flow through the server can be visualized as:
 * ```txt
 * Client makes request
 *    |
 * Server receives request
 *    |
 * Server: Do I have a controller to handle this?
 *    | Yes                   | No
 * Global middleware      Send default response
 *    |
 * Handling controller middleware
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
 * server encounters an uncaught error that's _not_ and HttpError, it responds with
 * a 500.
 */
export class HttpServer {
  /**
   * Triggered when the server encounters an uncaught error. This can occur
   * when middleware or a request handler throws an error that it doesn't catch.
   *
   * The server catches all errors and any error that's not a specific
   * error recognized by the server results in a 500 response.
   */
  onError = new Event<ServerErrorHandler>();
  /**
   * Triggered when the server determines it has no controller to handle the
   * incoming request and is going to send the default response.
   */
  onDefault = new Event<DefaultResponseHandler>();

  #base?: string;
  #controllers: Controller[] = [];
  #globalMiddleware: MiddlewareHousing = new MiddlewareHousing();
  #httpServer: Deno.HttpServer | undefined;
  #defaultResponseHandler: (req: Request) => Response = () => new Response(undefined, { status: 404 });

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
          onListen: () => {
            console.log(`Server listening on port ${port}.`);

            resolve();
          },
        },
        this.#handleHttpRequest
      );
    });
  }

  /**
   * Stops the server. It will no longer receive requests and the port
   * it was listening on will be freed.
   */
  async stop() {
    console.log('Server is stopping.');

    await this.#httpServer?.shutdown();
  }

  /**
   * Sets the server's base path. This is the path that a client must include
   * to talk to the server. For example, if you set this to `/api`, clients
   * must start their request paths with `/api`, otherwise the server won't
   * handle the request.
   *
   * If this isn't set, there's no required base path to talk to the server.
   *
   * @param basePath - The base path to use.
   *
   * @returns The server instance.
   */
  base(basePath: string): HttpServer {
    this.#base = basePath;

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
   * @returns The server instance.
   */
  defaultResponseHandler(handler: (req: Request) => Response): HttpServer {
    this.#defaultResponseHandler = handler;

    return this;
  }

  /**
   * Adds the provided middleware to the global middleware chain.
   * Global middleware only runs when the server determines it can handle
   * the request, and it runs before anything else.
   *
   * Middleware runs in the order provided.
   *
   * This method is additive and may be called any number of times. Calling
   * it more than once won't remove the middleware from previous invocations.
   *
   * @param middleware - The middleware to add.
   *
   * @returns The server instance.
   */
  globalMiddleware(...middleware: Middleware[]): HttpServer {
    this.#globalMiddleware.add(...middleware);

    return this;
  }

  /**
   * Adds the specified controller to the server. Controllers are the
   * heart of the server and inform it on what requests it can and cannot
   * handle. If a request comes in and the server can't find an appropriate
   * request handler in one of its registered controllers, it will send
   * back the default response. No processing will happen on that request.
   *
   * @param c - The controller to add.
   *
   * @returns The server instance.
   */
  controller(c: Controller): HttpServer {
    this.#controllers.push(c);

    return this;
  }

  #handleHttpRequest: Deno.ServeHandler = async (req: Request) => {
    try {
      const reqUrl = new URL(req.url);

      const { controller, handler, params } = this.#getHandler(req.method as HttpMethod, reqUrl.pathname) ?? {};

      if (controller && handler) {
        const headers = new Headers();

        await this.#globalMiddleware.runMiddleware(req, headers);
        await controller.runMiddleware(req, headers);

        const res = await handler(req, params);

        const finalHeaders = new Headers(Object.fromEntries([...headers.entries(), ...res.headers.entries()]));

        [...res.headers.keys()].map((header) => res.headers.delete(header));
        finalHeaders.forEach((headerValue, headerName) => {
          res.headers.set(headerName, headerValue);
        });

        return res;
      }

      this.onDefault.trigger(req);

      return this.#defaultResponseHandler(req);
    } catch (error) {
      this.onError.trigger(error);

      return new Response(undefined, {
        status: error instanceof HttpError ? error.status : 500,
      });
    }
  };

  #getHandler(
    method: HttpMethod,
    path: string
  ): { controller: Controller; handler?: RequestHandler; params?: Record<string, string> } | undefined {
    if (baseMatchesPath(this.#base, path)) {
      const pathWithoutServerBase = this.#base ? path.replace(this.#base, '') : path;

      const controller = this.#controllers.find((controller) => controller.matchesPath(pathWithoutServerBase));

      if (controller) {
        const { handler, params } = controller.getRequestHandler(method, pathWithoutServerBase) ?? {};

        return {
          controller,
          handler,
          params,
        };
      }
    }

    return undefined;
  }
}
