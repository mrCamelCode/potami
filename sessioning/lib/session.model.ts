export interface Session<T> {
  id: string;
  /**
   * The point in time when this session expires, expressed in MS.
   *
   * @example
   * ```ts
   * const isSessionExpired = Date.now() >= session.exp;
   * ```
   */
  exp: number;
  data?: T;
}

export type SessionDataSetter<T> = (currentData: T | undefined) => T | undefined;

/**
 * Helper type that represents what the `handleSessioning` middleware assigns to the
 * `sessionContext` `Context` instance.
 */
export interface SessionContext<T> {
  /**
   * The current session object, pulled from the session store.
   *
   * If you want to set `data` on this session, use
   * the `setSessionData` function that's also on this context. Changes
   * will be persisted in the session store.
   *
   * @example
   * ```ts
   * // Update the store in the context as well as in the store. Session data set
   * // this way is persisted in the store and will be loaded onto the `session`
   * // when another request bearing the session token comes into the server.
   * await setSessionData((curr) => ({ ...curr, cartItems: ['1', '2', '3']}));
   * ```
   */
  session: Session<T>;
  /**
   * Sets the data on the session based on the `dataOrSetter` provided.
   * This function will update the `sessionContext` you provided to the `handleSessioning` middleware.
   *
   * There exists a very rare edge case when you don't refresh sessions
   * when they're fetched. It's possible that a request enters the server
   * with a valid, unexpired session but by the time you call this function,
   * the session has expired. Normally, setting session data on an expired session
   * could result in `undefined` because the session didn't exist in the store anymore.
   * Because this middleware guarantees the session always exists, it handles this edge
   * case by creating a _new_ session with the data provided by `dataOrSetter`. If using
   * a setter, it receives the original session's data.
   *
   * @param dataOrSetter - The data to set on the session, or a callback that returns
   * the new data.
   */
  setSessionData: (dataOrSetter: T | SessionDataSetter<T>) => Promise<void>;
}

export function getDefaultSessionContext<SessionData>(defaultData?: SessionData): SessionContext<SessionData> {
  return {
    session: {
      exp: 0,
      id: '-1',
      data: defaultData,
    },
    // deno-lint-ignore require-await
    setSessionData: async () => {
      throw new Error(
        'Attempted to invoke the default setSessionData. The request must go through the handleSessioning middleware before trying to modify the session data.'
      );
    },
  };
}
