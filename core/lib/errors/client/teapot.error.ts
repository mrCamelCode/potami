import { HttpError } from '../http.error.ts';

/**
 * Convenience error that corresponds to an HTTP 418 response.
 */
export class TeapotError extends HttpError {
  constructor(msg?: string) {
    super(418, msg);
  }
}
