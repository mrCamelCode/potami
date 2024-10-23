import type { Session, SessionDataSetter } from './session.model.ts';

export interface SessionFetchOptions {
  /**
   * Whether the act of fetching a valid session should
   * refresh the session token. This modifies the session's expiration to a time in the future as though
   * the token were created now.
   *
   * Defaults to `true`.
   */
  refresh?: boolean;
}

/**
 * Interface that session stores intended to be used with Potami's sessioning
 * solution must follow.
 * 
 * The particular storage method is an implementation detail, but all implementations
 * must have a concept of expiration (and therefore a TTL) for sessions that are
 * put into the store. This point is mentioned mostly for clarification, as documentation
 * describing the contract implementors must follow imply that sessions have an expiration.
 * The generic {@link Session} object implementors must use also reflects such data.
 */
export interface ISessionStore<T> {
  /**
   * Attempts to fetch the specified session from the store.
   *
   * @param id - The ID of the session you'd like to retrieve from the store.
   * @param sessionFetchOptions - Optional additional options to control how the fetch works.
   *
   * @return The `Session` specified by the `id` if it was present and not expired in the store.
   */
  fetchSession(id: Session<T>['id'], sessionFetchOptions?: SessionFetchOptions): Promise<Session<T> | undefined>;
  /**
   * Creates a new session, assigning a unique ID.
   *
   * @param data - The data, if any, to attach to the session.
   */
  createSession(data?: T): Promise<Session<T>>;
  /**
   * Attempts to delete the specified `Session` from the store.
   *
   * If a `Session` with `id` doesn't exist, nothing happens.
   *
   * @param id - The ID of the `Session` you'd like to delete.
   */
  deleteSession(id: Session<T>['id']): Promise<void>;
  /**
   * Removes any expired sessions from the store.
   *
   * Depending on the implementation, this may be a slow process,
   * as it will likely have to check every existing session. If
   * the implementation offers an underlying store that automatically
   * deletes expired sessions, it's best to rely on that mechanism
   * instead of manually purging.
   *
   * All implementations of this interface
   * must guarantee that even if an expired session technically _exists_ in their store,
   * those sessions are not returned when fetching a session.
   */
  purge(): Promise<void>;
  /**
   * @param id - The ID of the session you want to set the data for.
   * @param data - The data you want to assign to the session. This overwrites the existing data.
   *
   * @returns The updated session, or `undefined` if the session did not exist or was expired.
   */
  setSessionData(id: Session<T>['id'], data: T | undefined): Promise<Session<T> | undefined>;
  /**
   * @param id - The ID of the session you want to set the data for.
   * @param dataSetter - A setter function that will receive the current data stored on the session and returns the new
   * data. The new data will overwrite the existing data. This setter is useful when you want to base the next state of
   * the data on the current state (i.e. you want to spread an object to maintain its current properties, but change/add
   * some new ones). **This function should be pure.** In the event the session is especially volatile,
   * this function may be called multiple times depending on the implementation.
   *
   * @returns The updated session, or `undefined` if the session did not exist or was expired.
   */
  setSessionData(id: Session<T>['id'], dataSetter: SessionDataSetter<T>): Promise<Session<T> | undefined>;
  /**
   * @param id - The ID to test.
   *
   * @returns Whether the provided session ID is valid according to how the
   * the store generates session IDs. If your session IDs follow a particular
   * format, it's best to implement this function to match on that format.
   * This method can be used to test incoming session IDs to test for malicious
   * probing.
   */
  isSessionIdValid(id: Session<T>['id']): boolean;
}
