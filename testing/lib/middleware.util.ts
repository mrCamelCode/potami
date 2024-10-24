import { HttpServer, type BaseRequestContext, type DefaultRequestContext, type MiddlewareSubjects } from '@potami/core';

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
 * @param subjects - Any subjects you'd like to provide. Unprovided subjects
 * are given defaults.
 *
 * @returns The provided subjects, with defaults for any unprovided ones.
 */
export function makeMiddlewareSubjects<Context extends BaseRequestContext = DefaultRequestContext>(
  subjects: Partial<MiddlewareSubjects<Context>> = {}
): MiddlewareSubjects<Context> {
  return {
    req: new Request('http://localhost:3000'),
    resHeaders: new Headers(),
    server: new HttpServer<Context>(),
    remoteAddr: {
      transport: 'tcp',
      hostname: '127.0.0.1',
      port: 40000,
    },
    // @ts-ignore - ctx will be populated by middleware.
    ctx: {},
    ...subjects,
  };
}
