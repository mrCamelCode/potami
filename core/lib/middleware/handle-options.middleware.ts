import { Controller } from '../controller.ts';
import { HttpMethod, type Middleware } from '../model.ts';
import { getRequestPath } from '../util.ts';

export interface HandleOptionsOptions {
  /**
   * (Defaults to 200) The status to send back when
   * the middleware generates a successful response. 200 and 204
   * are the valid status codes for the method, but
   * [some browsers incorrectly interpret 204](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/OPTIONS).
   */
  successStatus?: 200 | 204;
}

/**
 * Intended to be used as Entry Middleware. This middleware will
 * automatically handle OPTIONS requests to the server by
 * responding with all valid methods that can be done on the
 * path provided in the request.
 *
 * This middleware will only handle OPTIONS requests to specific
 * URLs. `*` paths are not supported.
 *
 * **Note:** If you need to support OPTIONS requests because of CORS, you should
 * use the `handleCors` middleware instead.
 */
export const handleOptions =
  ({ successStatus = 200 }: HandleOptionsOptions = {}): Middleware =>
  ({ req, server }) => {
    if (req.method === HttpMethod.Options) {
      const reqPath = getRequestPath(req);

      const handlingController = server.getHandlingController(reqPath);

      if (handlingController) {
        const validMethodsForPath = handlingController
          .getRequestHandlerNamesForPath(server.getPathWithoutServerBase(reqPath))
          .map((handlerName) => Controller.getRequestHandlerNameParts(handlerName)?.method?.toUpperCase())
          .filter(Boolean) as string[];

        return new Response(undefined, {
          status: successStatus,
          headers: {
            allow: validMethodsForPath.join(', '),
          },
        });
      } else {
        return new Response(undefined, {
          status: successStatus,
          headers: {
            allow: '',
          },
        });
      }
    }
  };
