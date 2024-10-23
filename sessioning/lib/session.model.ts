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
 * Helper type that represents what the `handleSessioning` middleware adds to your
 * `ctx`. It's recommended that if you use `handleSessioning` you use this type to
 * extend your app's context type.
 */
export interface SessionContext<T> {
  /**
   * The current session object, pulled from the session store.
   *
   * You can update the `data` property of this object (do **NOT**
   * update other properties) if you want to put data on the session
   * that will disappear after this request is handled.
   *
   * If you want to set `data` on this session and persist those
   * changes in the session store so that data exists on the _next_
   * request bearing the corresponding session token, you should use
   * the `setSessionData` function that's also on this context.
   *
   * @example
   * ```ts
   * // Ephemeral session data, won't be present on the session after Potami
   * // sends a response for this request. Can be useful for storing
   * // session-scoped data that varies between requests that you wouldn't want
   * // to persist.
   * ctx.session.data.requestHadSpecialHeader = false;
   * ```
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
   * This function will update the `ctx.session`.
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
