/**
 * Convenience class that automatically stringifies the provided
 * `body` as JSON and sets the 'content-type' header to
 * `'application/json; charset=utf-8'`.
 *
 * Useful if you want to respond with JSON.
 */
export class JsonResponse<T extends object> extends Response {
  constructor(body: T, init?: ResponseInit) {
    super(JSON.stringify(body), {
      ...init,
      headers: {
        ...init?.headers,
        'content-type': 'application/json; charset=utf-8',
      },
    });
  }
}
