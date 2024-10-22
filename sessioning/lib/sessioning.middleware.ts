import type { BaseRequestContext, Middleware } from '@potami/core';
import { cookies } from '../deps.ts';
import type { ISessionStore, SessionFetchOptions } from './session-store.interface.ts';
import type { Session, SessionContext } from './session.model.ts';

export interface HandleSessioningOptions<T> {
  store: ISessionStore<T>;
  /**
   * The name to use for the session cookie. According
   * to [OWASP recommendations](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
   * this shouldn't be overly specific as to leak the technology the
   * server is built on. The default follows this guideline. It's not
   * recommended to change the default unless you have a very compelling
   * reason to do so.
   *
   * Defaults to `'id'`.
   */
  sessionCookieName?: string;
  /**
   * Any options for how the middleware behaves when fetching a session.
   * This follows the same rules and defaults as the options available in
   * {@link ISessionStore.fetchSession}.
   */
  sessionFetchOptions?: SessionFetchOptions;
  /**
   * Callback that's called when the middleware encounters a session ID on
   * the request that isn't a valid session ID.
   *
   * @param sessionId - The sessionId that was received.
   */
  onReceivedInvalidSessionId?: (sessionId: string) => void;
  /**
   * Attributes to include on the session cookie. This configuration defaults
   * to the most secure settings. Unless you have an exceedingly good reason to
   * change them and understand any risks you're accepting by doing so, it's
   * recommended you don't modify this option.
   *
   * The only exception to this rule would be providing good values for the
   * `domain` and `path` attributes. As these attributes are highly application-specific
   * and this middlware simply cannot know a good default.
   *
   * To understand sessions and the impact of changing any of these from their
   * secure defaults, you can refer to this [OWASP cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#cookies).
   */
  cookieAttributes?: {
    /**
     * Whether the browser should only transmit this cookie over a secure (HTTPS)
     * connection.
     *
     * Defaults to `true`.
     */
    secure?: boolean;
    /**
     * Whether the browser should block scripts from accessing this cookie.
     *
     * Defaults to `true`.
     */
    httpOnly?: boolean;
    /**
     * Whether the browser should only send this cookie to the site it came from.
     * This aids in mitigating the risk of CSRF attacks.
     *
     * Defaults to `'Strict'`.
     */
    sameSite?: 'Strict' | 'Lax' | 'None';
    /**
     * The domain this cookie is valid for. Avoid setting an overly permissive
     * value. For details, refer to this [OWASP cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#domain-and-path-attributes).
     *
     * Has no default, which means the browser will only send the cookie to the origin server.
     */
    domain?: string;
    /**
     * The path
     *
     * Defaults to `'/'`, which means the cookie will be sent to all URL paths at `domain`.
     */
    path?: string;
    /**
     * The number of seconds until the cookie is supposed to expire. Refer to
     * [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#max-agenumber)
     * for more info.
     *
     * Has no default. If neither `maxAge` nor `expires` are specified, the cookie is a session
     * cookie and will automatically be discarded when the browser is closed. This is preferable.
     * Only use a persistent cookie if you have a specific reason to.
     */
    maxAge?: number;
    /**
     * A function that returns the expiration date of the cookie. Because the expiration date is
     * likely to vary by the time at which the cookie is created, this is a function instead of
     * a constant. This will be invoked at the time the cookie is created to determine the
     * expiration date.
     *
     * Has no default. If neither `maxAge` nor `expires` are specified, the cookie is a session
     * cookie and will automatically be discarded when the browser is closed. This is preferable.
     * Only use a persistent cookie if you have a specific reason to.
     *
     * @returns The expiration date.
     */
    expires?: () => Date;
  };
}

export const handleSessioning =
  <SessionDataType, AppContextType extends BaseRequestContext & SessionContext<SessionDataType>>({
    store,
    sessionCookieName = 'id',
    onReceivedInvalidSessionId,
    sessionFetchOptions,
    cookieAttributes,
  }: HandleSessioningOptions<SessionDataType>): Middleware<AppContextType> =>
  async ({ req, resHeaders, ctx }) => {
    const sessionId = getSessionIdFromRequest(req, sessionCookieName);

    if (sessionId && !store.isSessionIdValid(sessionId)) {
      onReceivedInvalidSessionId?.(sessionId);
    }

    const session = sessionId
      ? (await store.fetchSession(sessionId, sessionFetchOptions)) ?? (await store.createSession())
      : await store.createSession();

    setSessionCookieHeader(resHeaders, sessionCookieName, session, cookieAttributes);

    ctx.session = session;
  };

function getSessionIdFromRequest(req: Request, sessionCookieName: string): string | undefined {
  const readCookies = cookies.getCookies(req.headers);

  return readCookies[sessionCookieName];
}

function setSessionCookieHeader<T>(
  headers: Headers,
  sessionCookieName: string,
  session: Session<T>,
  {
    secure = true,
    httpOnly = true,
    sameSite = 'Strict',
    domain,
    path = '/',
    maxAge,
    expires,
  }: HandleSessioningOptions<T>['cookieAttributes'] = {}
): void {
  const cookie: cookies.Cookie = {
    name: sessionCookieName,
    value: session.id,
    secure,
    httpOnly,
    sameSite,
    domain,
    path,
    maxAge,
    expires: expires?.(),
  };

  cookies.setCookie(headers, cookie);
}
