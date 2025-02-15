import type { Context, RequestHandlerSubjects } from '@potami/core';

/**
 * Utility for creating the object that's provided to `RequestHandler`s. You
 * may provide your own subjects if you want specific values for your test case.
 * Otherwise, defaults are used. The default `req` is a request coming to
 * `http://localhost:3000`. The `params` are empty. The request is coming
 * from `127.0.0.1`, is using `tcp`, and `port` `40000`.
 * 
 * **A note on Context**
 * 
 * For context, the `getContext` function always returns the context's default value.
 * This is sufficient for unit testing, since you can provide your own implementation
 * when testing so you can test what your controller does when it sees a particular value for a particular
 * context. If using context isn't relevant for your test case, you don't have to provide an implementation.
 * Because a unit test's scope shouldn't extend past one request handler at a time,
 * you shouldn't need to be setting context in a test for a request handler.
 * Know that trying to extend the test past the scope of one request handler will mean any context you set
 * elsewhere won't be retrievable from the request handler's `getContext`. If you need to track how your
 * server will update and read context through a flow that extends past a single request handler,
 * you have moved out of the scope of a unit test. You should consider writing a
 * test that starts a more complete environment and test your server more like
 * a real client.
 * 
 * @param subjects - Any subjects you'd like to provide. Unprovided subjects
 * are given defaults.
 * 
 * @returns The provided subjects, with defaults for any unprovided ones.
 */
export function makeRequestHandlerSubjects(subjects: Partial<RequestHandlerSubjects> = {}): RequestHandlerSubjects {
  return {
    req: new Request('http://localhost:3000'),
    params: {},
    remoteAddr: {
      transport: 'tcp',
      hostname: '127.0.0.1',
      port: 40000,
    },
    getContext: <T>(context: Context<T>) => {
      return context.defaultValue;
    },
    ...subjects,
  };
}
