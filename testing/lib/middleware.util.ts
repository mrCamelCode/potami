import { type Context, HttpServer, type MiddlewareSubjects } from '@potami/core';

/**
 * Utility for creating the subjects for middleware. Conveniently,
 * this function provides defaults for any subjects you don't provide.
 * This allows you to write tests for middleware that satisfy Potami's
 * types without rotely creating your own mock requests, headers, etc.
 * all the time. By using this function, you can provide only the subjects
 * your tests care about and need to make assertions on.
 *
 * Using this function also makes your tests more resilient to updates,
 * as Potami may add subjects in the future. As subjects are added,
 * this function will be updated to provide defaults so you don't have
 * to do that maintenance work.
 *
 * For context, the default for `getContext` will always return the context's default value.
 * The default for `setContext` does nothing.
 *
 * @param subjects - Any subjects you'd like to provide. Unprovided subjects
 * are given defaults.
 *
 * @returns The provided subjects, with defaults for any unprovided ones.
 */
export function makeMiddlewareSubjects(subjects: Partial<MiddlewareSubjects> = {}): MiddlewareSubjects {
  return {
    req: new Request('http://localhost:3000'),
    resHeaders: new Headers(),
    server: new HttpServer(),
    remoteAddr: {
      transport: 'tcp',
      hostname: '127.0.0.1',
      port: 40000,
    },
    getContext: <T>(context: Context<T>) => {
      return context.defaultValue;
    },
    setContext: <T>(_context: Context<T>, _value: T) => {},
    ...subjects,
  };
}
