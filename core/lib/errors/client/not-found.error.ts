import { HttpError } from '../http.error.ts';

/**
 * Convenience error that corresponds to an HTTP 404 response.
 */
export class NotFoundError extends HttpError {
  constructor(msg?: string) {
    super(404, msg);
  }
}
