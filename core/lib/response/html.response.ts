/**
 * Convenience class that automatically wraps the provided HTML
 * string given in `body` in the `<html>` tag and sets the
 * 'content-type' header to `'text/html'`.
 */
export class HtmlResponse extends Response {
  /**
   * @param body - The body of your HTML document. **DO NOT** include
   * the `<html>` tag, your body is automatically wrapped in it.
   * @param init
   */
  constructor(body: string, init?: ResponseInit) {
    super(`<html>${body}</html>`, {
      ...init,
      headers: {
        ...init?.headers,
        'content-type': 'text/html',
      },
    });
  }
}
