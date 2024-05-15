import { HttpError } from '../http.error.ts';

/**
 * Convenience error that corresponds to an HTTP 401 response.
 *
 * Note that the technical meaning of a 401 is `Unauthorized`,
 * but the name is misleading. The actual meaning is that the
 * client isn't authenticated at all. The technically correct
 * name `Unauthorized` tends to lead to confusion with the 403
 * code `Forbidden`, so this error is called `UnauthenticatedError`
 * to avoid that confusion.
 */
export class UnauthenticatedError extends HttpError {
  constructor(msg?: string) {
    super(401, msg);
  }
}
