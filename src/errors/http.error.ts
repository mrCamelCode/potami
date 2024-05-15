/**
 * Superclass for any HTTP error. Allows setting a status that the
 * fallback catch of the server will use in its response.
 */
export class HttpError extends Error {
  constructor(public readonly status: number, msg?: string) {
    super(msg);
  }
}
