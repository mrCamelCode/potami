import { HttpError } from '../http.error.ts';

/**
 * Convenience error that corresponds to an HTTP 500 response.
 */
export class ServerError extends HttpError {
  constructor(msg?: string) {
    super(500, msg);
  }
}
