import { HttpError } from '../http.error.ts';

/**
 * Convenience error that corresponds to an HTTP 400 response.
 */
export class BadRequestError extends HttpError {
  constructor(msg?: string) {
    super(400, msg);
  }
}
