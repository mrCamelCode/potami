/**
 * Utility type that's equivalent to `T | Promise<T>`.
 */
export type MaybePromise<T> = T | Promise<T>;
