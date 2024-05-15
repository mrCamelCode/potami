import { HttpError } from '../http.error.ts';

/**
 * Convenience error that corresponds to an HTTP 503 response.
 */
export class ServiceUnavailableError extends HttpError {
  constructor(msg?: string) {
    super(503, msg);
  }
}
