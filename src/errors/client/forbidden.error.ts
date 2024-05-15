import { HttpError } from '../http.error.ts';

/**
 * Convenience error that corresponds to an HTTP 403 response.
 */
export class ForbiddenError extends HttpError {
  constructor(msg?: string) {
    super(403, msg);
  }
}
