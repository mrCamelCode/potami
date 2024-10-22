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

/**
 * Helper type that represents what the `handleSessioning` middleware adds to your
 * `ctx`. It's recommended that if you use `handleSessioning` you use this type to
 * extend your app's context type.
 */
export interface SessionContext<T> {
  session?: Session<T>;
}
