import { HttpError } from '../http.error.ts';

/**
 * Convenience error that corresponds to an HTTP 501 response.
 */
export class NotImplementedError extends HttpError {
  constructor(msg?: string) {
    super(501, msg);
  }
}
