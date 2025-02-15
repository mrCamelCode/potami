import type { Context, Middleware } from '@potami/core';
import { cookies } from '../deps.ts';
import type { ISessionStore, SessionFetchOptions } from './session-store.interface.ts';
import type { Session, SessionContext, SessionDataSetter } from './session.model.ts';

export interface HandleSessioningOptions<T> {
  store: ISessionStore<T>;
  /**
   * The `Context` instance to use for the session context. You'll use this same instance
   * with `getContext` to read the session data. If you'd like to update the session data,
   * use the `setSessionData` available on this context instead of calling `setContext`.
   * 
   * @example
   * ```ts
   * // Do:
   * const { setSessionData } = getContext({ sessionContext });
   * 
   * setSessionData({ myData: 123 });
   * 
   * // DON'T:
   * setContext(sessionContext, { ...getContext(sessionContext), session: { myData: 123 }});
   * ```
   */
  sessionContext: Context<SessionContext<T>>;
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

/**
 * Intended to be used as Entry Middleware. This middleware allows your server
 * to handle sessions. Sessions are persisted by leveraging the provided `store`.
 *
 * This middleware handles all aspects of sessioning, including:
 * - Reading the session token off incoming requests.
 * - Populating the `sessionContext` based on the session token present or absent on incoming requests.
 * - Setting the session token cookie based on the currently valid session.
 * - Monitoring for probing by validating incoming session tokens.
 *
 * This middleware guarantees that there is always a session on the `sessionContext` so long as this middleware
 * runs before anything that tries to access the `sessionContext`. If a request enters the server
 * without a session token, a new session is created.
 *
 * Sessions allow for app-specific `data` to be added to them. See the documentation for {@link SessionContext.session}
 * for ways to correctly update the session's data based on your needs.
 *
 * This middleware relies on cookies for transmission of a session token between client and server.
 * Cookies were selected over other methods because cookies allow for tighter security controls. By
 * default, the session cookie is simply called `id`. This can be configured via the `sessionCookieName`
 * option, though its recommended to keep the name vague. `id` was selected to be intentionally
 * vague per OWASP recommendations, as overly specific cookie names can be used
 * by malicious parties to infer the technology a server is built with. It's recommended you only change
 * the name from its default if the default name conflicts with a cookie your server uses for something
 * else.
 */
export const handleSessioning =
  <SessionDataType>({
    store,
    sessionContext,
    sessionCookieName = 'id',
    onReceivedInvalidSessionId,
    sessionFetchOptions,
    cookieAttributes,
  }: HandleSessioningOptions<SessionDataType>): Middleware =>
  async ({ req, resHeaders, getContext, setContext }) => {
    const sessionId = getSessionIdFromRequest(req, sessionCookieName);

    if (sessionId && !store.isSessionIdValid(sessionId)) {
      onReceivedInvalidSessionId?.(sessionId);
    }

    const session = sessionId
      ? (await store.fetchSession(sessionId, sessionFetchOptions)) ?? (await store.createSession())
      : await store.createSession();

    setSessionCookieHeader(resHeaders, sessionCookieName, session, cookieAttributes);

    setContext(sessionContext, {
      session,
      setSessionData: async (dataOrSetter) => {
        const updatedSession = await store.setSessionData(
          session.id,
          // @ts-ignore - Complaining that it doesn't know which overload to use, which doesn't matter.
          dataOrSetter
        );

        let newSession: Session<SessionDataType>;

        if (updatedSession) {
          newSession = updatedSession;
        } else {
          // Edge case where session was NOT expired when it entered the server,
          // but is now expired when this function is called. We create a new session
          // and attach the original session's data to it, effectively extending the
          // session.
          const newData: SessionDataType | undefined =
            typeof dataOrSetter === 'function'
              ? (dataOrSetter as SessionDataSetter<SessionDataType>)(session.data)
              : dataOrSetter;

          newSession = await store.createSession(newData);
        }

        setSessionCookieHeader(resHeaders, sessionCookieName, newSession, cookieAttributes);

        setContext(sessionContext, {
          ...getContext(sessionContext),
          session: newSession,
        });
      },
    });
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

  // Ensure there aren't redundant session cookies.
  const currentCookies = headers.getSetCookie();
  const cookiesWithoutExistingSessionCookie = currentCookies
    .filter((cookie) => !cookie.includes(`${sessionCookieName}=`))
    .filter(Boolean);

  headers.set('Set-Cookie', cookiesWithoutExistingSessionCookie.join(', '));

  cookies.setCookie(headers, cookie);
}
