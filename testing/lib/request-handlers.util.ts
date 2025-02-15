import type { Context, RequestHandlerSubjects } from '@potami/core';

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
