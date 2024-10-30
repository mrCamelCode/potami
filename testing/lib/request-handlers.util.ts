import type { BaseRequestContext, DefaultRequestContext, RequestHandlerSubjects } from '@potami/core';

export function makeRequestHandlerSubjects<Context extends BaseRequestContext = DefaultRequestContext>(
  subjects: Partial<RequestHandlerSubjects<Context>> = {}
): RequestHandlerSubjects<Context> {
  return {
    req: new Request('http://localhost:3000'),
    params: {},
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
