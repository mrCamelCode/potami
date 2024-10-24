import { HttpError } from '@potami/core';
import { makeMiddlewareSubjects } from '@potami/testing';
import { assert, assertEquals } from 'assert';
import { describe, test } from 'bdd';
import { assertSpyCallArg, assertSpyCalls, spy } from 'mock';
import { handleRateLimiting } from '../handle-rate-limiting.middleware.ts';
import { IpRateLimiter } from '../ip-rate-limiter.impl.ts';

describe('handleRateLimiting', () => {
  test(`lets requests through when a limit isn't reached`, async () => {
    const middleware = handleRateLimiting({ rateLimiter: new IpRateLimiter() });

    await middleware(makeMiddlewareSubjects());

    assert(true);
  });
  test(`throws a 429 by default when a limit is reached`, async () => {
    const middleware = handleRateLimiting({ rateLimiter: new IpRateLimiter({ maxRequestsPerWindow: 0 }) });

    try {
      await middleware(makeMiddlewareSubjects());

      assert(false);
    } catch (error) {
      assert(error instanceof HttpError);
      assertEquals((error as HttpError).status, 429);
    }
  });
  test(`calls a custom function when provided for onLimitReached and does not throw`, async () => {
    const subjects = makeMiddlewareSubjects();

    const onLimitReached = spy();
    const middleware = handleRateLimiting({
      rateLimiter: new IpRateLimiter({ maxRequestsPerWindow: 0 }),
      onLimitReached,
    });

    await middleware(subjects);

    assertSpyCalls(onLimitReached, 1);
    assertSpyCallArg(onLimitReached, 0, 0, subjects.req);
    assertSpyCallArg(onLimitReached, 0, 1, subjects.remoteAddr);
  });
});
