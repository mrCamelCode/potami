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
 * **A note on Context**
 * 
 * For context, there is a very minimal implementation. Setting context will
 * register a value to that context within the singular scope of this middleware.
 * Getting context will return whatever the value was set to, or the default
 * value if it wasn't set. This is sufficient for unit testing, since a unit
 * test's scope shouldn't extend past one middleware at a time. Know that trying
 * to extend the test past one middleware will mean any context you set in one
 * middleware won't be retrievable from the other. If you need to track how your
 * server will update context through a flow that extends past a single middleware,
 * you have moved out of the scope of a unit test. You should consider writing a
 * test that starts a more complete environment and test your server more like
 * a real client.
 *
 * @param subjects - Any subjects you'd like to provide. Unprovided subjects
 * are given defaults.
 *
 * @returns The provided subjects, with defaults for any unprovided ones.
 */
export function makeMiddlewareSubjects(subjects: Partial<MiddlewareSubjects> = {}): MiddlewareSubjects {
  const ctx: Record<Context['id'], Context> = {};

  return {
    req: new Request('http://localhost:3000'),
    resHeaders: new Headers(),
    server: new HttpServer(),
    remoteAddr: {
      transport: 'tcp',
      hostname: '127.0.0.1',
      port: 40000,
    },
    getContext: <T>(context: Context<T>): T => {
      return (ctx[context.id] ?? context.defaultValue) as T;
    },
    setContext: <T>(context: Context<T>, value: T) => {
      // @ts-ignore: If the value is of T, which matches the context's expected value, value is always assignable to that context.
      ctx[context.id] = value;
    },
    ...subjects,
  };
}
