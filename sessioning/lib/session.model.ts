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

export interface SessionContext<T> {
  session?: Session<T>;
}
