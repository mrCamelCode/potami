import { assert, assertEquals } from 'assert';
import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'bdd';
import { restore, spy, stub } from 'mock';
import { Controller } from '../controller.ts';
import { TeapotError } from '../errors/client/teapot.error.ts';
import { UnauthenticatedError } from '../errors/client/unauthenticated.error.ts';
import { HttpServer } from '../http-server.ts';
import { Middleware, RequestHandler } from '../model.ts';
import { JsonResponse } from '../response/json.response.ts';

/**
 * There's a bug with fetch atm: https://github.com/denoland/deno/issues/21661
 *
 * I can't stop and start the server on the same port between tests without fetch
 * complaining about the connection closing before it could send the message, even
 * though the connection it SHOULD be using is fine for the lifetime of test. The
 * server doesn't stop until the tests are done. Until that's fixed, we'll just have
 * to start the server on different ports for every test :sadge:.
 */
let currentPort = 3000;

const getBaseRoute = () => `http://localhost:${currentPort}`;

describe('HttpServer', () => {
  let server: HttpServer;
  beforeAll(() => {
    stub(console, 'log');
  });
  beforeEach(async () => {
    server = new HttpServer();

    await server.controller(new TestController()).start(currentPort);
  });
  afterEach(async () => {
    await server.stop();
    currentPort++;
  });
  afterAll(() => {
    restore();
  });

  describe('path resolution', () => {
    describe('without base server path', () => {
      test(`returns a 404 when there is no controller to handle the path`, async () => {
        const responses = await Promise.all([
          fetch(`${getBaseRoute()}/nope`),
          fetch(`${getBaseRoute()}/has/a/path`),
          fetch(`${getBaseRoute()}/not/a/path`),
        ]);

        responses.forEach((res) => {
          assertEquals(res.status, 404);
        });

        await cleanupResponses(...responses);
      });
      test(`returns the expected response when there is a controller to handle the path at the root of the controller`, async () => {
        const responses = await Promise.all([fetch(`${getBaseRoute()}/test/`), fetch(`${getBaseRoute()}/test`)]);

        for (const res of responses) {
          assertEquals(res.status, 200);
          assertEquals((await res.json()).path, '/');
        }

        await cleanupResponses(...responses);
      });
      test(`returns the expected response when there is a controller to handle a path NOT at the root of the controller`, async () => {
        const responses = await Promise.all([
          fetch(`${getBaseRoute()}/test/some/path/`),
          fetch(`${getBaseRoute()}/test/some/path`),
        ]);

        for (const res of responses) {
          assertEquals(res.status, 200);
          assertEquals((await res.json()).path, '/some/path');
        }

        await cleanupResponses(...responses);
      });
      test(`picks the right handler for the method when a path has multiple supported methods`, async () => {
        const getResponse = await fetch(`${getBaseRoute()}/test`);

        assertEquals(getResponse.status, 200);

        const postResponse = await fetch(`${getBaseRoute()}/test`, { method: 'POST' });

        assertEquals(postResponse.status, 201);

        cleanupResponses(getResponse, postResponse);
      });
      test(`picks the path that matches best when the controller has multiple paths that match`, async () => {
        const responseWithoutParam = await fetch(`${getBaseRoute()}/test/has/a/path`);

        assertEquals(responseWithoutParam.status, 200);
        assertEquals((await responseWithoutParam.json()).path, '/has/a/path');

        const responseWithEmptyParam = await fetch(`${getBaseRoute()}/test/has/a/path/`);

        assertEquals(responseWithEmptyParam.status, 200);
        assertEquals((await responseWithEmptyParam.json()).path, '/has/a/path');

        const responseWithParam = await fetch(`${getBaseRoute()}/test/has/a/path/123`);

        assertEquals(responseWithParam.status, 200);
        assertEquals((await responseWithParam.json()).path, '/has/a/path/:param');

        cleanupResponses(responseWithoutParam, responseWithEmptyParam, responseWithParam);
      });
    });

    describe('with base server path', () => {
      beforeEach(() => {
        server.base('/api');
      });

      test(`returns a 404 when there is no controller to handle the path`, async () => {
        const responses = await Promise.all([
          fetch(`${getBaseRoute()}/api/nope`),
          fetch(`${getBaseRoute()}/has/a/path`),
          fetch(`${getBaseRoute()}/not/a/path`),
        ]);

        responses.forEach((res) => {
          assertEquals(res.status, 404);
        });

        await cleanupResponses(...responses);
      });
      test(`returns the expected response when there is a controller to handle the path at the root of the controller`, async () => {
        const responses = await Promise.all([
          fetch(`${getBaseRoute()}/api/test/`),
          fetch(`${getBaseRoute()}/api/test`),
        ]);

        for (const res of responses) {
          assertEquals(res.status, 200);
          assertEquals((await res.json()).path, '/');
        }

        await cleanupResponses(...responses);
      });
      test(`returns the expected response when there is a controller to handle a path NOT at the root of the controller`, async () => {
        const responses = await Promise.all([
          fetch(`${getBaseRoute()}/api/test/some/path/`),
          fetch(`${getBaseRoute()}/api/test/some/path`),
        ]);

        for (const res of responses) {
          assertEquals(res.status, 200);
          assertEquals((await res.json()).path, '/some/path');
        }

        await cleanupResponses(...responses);
      });
      test(`picks the right handler for the method when a path has multiple supported methods`, async () => {
        const getResponse = await fetch(`${getBaseRoute()}/api/test`);

        assertEquals(getResponse.status, 200);

        const postResponse = await fetch(`${getBaseRoute()}/api/test`, { method: 'POST' });

        assertEquals(postResponse.status, 201);

        cleanupResponses(getResponse, postResponse);
      });
      test(`picks the path that matches best when the controller has multiple paths that match`, async () => {
        const responseWithoutParam = await fetch(`${getBaseRoute()}/api/test/has/a/path`);

        assertEquals(responseWithoutParam.status, 200);
        assertEquals((await responseWithoutParam.json()).path, '/has/a/path');

        const responseWithEmptyParam = await fetch(`${getBaseRoute()}/api/test/has/a/path/`);

        assertEquals(responseWithEmptyParam.status, 200);
        assertEquals((await responseWithEmptyParam.json()).path, '/has/a/path');

        const responseWithParam = await fetch(`${getBaseRoute()}/api/test/has/a/path/123`);

        assertEquals(responseWithParam.status, 200);
        assertEquals((await responseWithParam.json()).path, '/has/a/path/:param');

        cleanupResponses(responseWithoutParam, responseWithEmptyParam, responseWithParam);
      });
    });
  });

  describe('route params', () => {
    test(`route params are properly parsed`, async () => {
      const response = await fetch(`${getBaseRoute()}/test/users/123/messages/321`);

      const json = await response.json();

      assertEquals(response.status, 200);
      assertEquals(json.path, '/users/:userId/messages/:messageId');
      assertEquals(json.params, { userId: '123', messageId: '321' });

      cleanupResponses(response);
    });
  });

  describe('HTTP errors', () => {
    test(`an HTTP error thrown in a global middleware is caught and its status reflected in the response`, async () => {
      server.globalMiddleware(() => {
        throw new UnauthenticatedError('NONE SHALL PASS!');
      });

      const response = await fetch(`${getBaseRoute()}/test`);

      assertEquals(response.status, 401);

      cleanupResponses(response);
    });
    test(`an HTTP error thrown in a controller middleware is caught and its status reflected in the response`, async () => {
      server.controller(
        new OtherTestController(() => {
          throw new UnauthenticatedError('NONE SHALL PASS!');
        })
      );

      const response = await fetch(`${getBaseRoute()}/otherTest`);

      assertEquals(response.status, 401);

      cleanupResponses(response);
    });
    test(`an HTTP error thrown in a request handler is caught and its status reflected in the response`, async () => {
      const response = await fetch(`${getBaseRoute()}/test/error`);

      assertEquals(response.status, 418);

      cleanupResponses(response);
    });
  });

  describe('middleware', () => {
    test(`global middleware runs in order when the server can handle the request`, async () => {
      const calledMiddleware: number[] = [];
      const middleware = [
        spy(() => {
          calledMiddleware.push(0);
        }),
        spy(() => {
          calledMiddleware.push(1);
        }),
      ];

      server.globalMiddleware(...middleware);

      const response = await fetch(`${getBaseRoute()}/test`);

      middleware.forEach((m) => {
        assert(m.calls.length === 1);
      });

      assertEquals(calledMiddleware[0], 0);
      assertEquals(calledMiddleware[1], 1);

      cleanupResponses(response);
    });
    test(`async global middleware is called in order`, async () => {
      const calledMiddleware: number[] = [];
      const middleware = [
        spy(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          calledMiddleware.push(0);
        }),
        spy(() => {
          calledMiddleware.push(1);
        }),
      ];

      server.globalMiddleware(...middleware);

      const response = await fetch(`${getBaseRoute()}/test`);

      middleware.forEach((m) => {
        assert(m.calls.length === 1);
      });

      assertEquals(calledMiddleware[0], 0);
      assertEquals(calledMiddleware[1], 1);

      cleanupResponses(response);
    });
    test(`controller middleware runs in order when the server can handle the request`, async () => {
      const calledMiddleware: number[] = [];
      const middleware = [
        spy(() => {
          calledMiddleware.push(0);
        }),
        spy(() => {
          calledMiddleware.push(1);
        }),
      ];

      server.controller(new OtherTestController(...middleware));

      const response = await fetch(`${getBaseRoute()}/otherTest`);

      middleware.forEach((m) => {
        assert(m.calls.length === 1);
      });

      assertEquals(calledMiddleware[0], 0);
      assertEquals(calledMiddleware[1], 1);

      cleanupResponses(response);
    });
    test(`async controller middleware is called in order`, async () => {
      const calledMiddleware: number[] = [];
      const middleware = [
        spy(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));

          calledMiddleware.push(0);
        }),
        spy(() => {
          calledMiddleware.push(1);
        }),
      ];

      server.controller(new OtherTestController(...middleware));

      const response = await fetch(`${getBaseRoute()}/otherTest`);

      middleware.forEach((m) => {
        assert(m.calls.length === 1);
      });

      assertEquals(calledMiddleware[0], 0);
      assertEquals(calledMiddleware[1], 1);

      cleanupResponses(response);
    });
    test(`no middleware runs when the server can't handle the request`, async () => {
      const calledMiddleware: number[] = [];
      const middleware = [
        spy(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));

          calledMiddleware.push(0);
        }),
        spy(() => {
          calledMiddleware.push(1);
        }),
      ];

      server.controller(new OtherTestController(...middleware));
      server.globalMiddleware(...middleware);

      const response = await fetch(`${getBaseRoute()}/nope`);

      middleware.forEach((m) => {
        assert(m.calls.length === 0);
      });

      assertEquals(calledMiddleware.length, 0);

      cleanupResponses(response);
    });

    describe('headers', () => {
      test(`headers added in global middleware appear in the response`, async () => {
        server.globalMiddleware((req, headers) => headers.set('custom', 'jt'));

        const response = await fetch(`${getBaseRoute()}/test`);

        assertEquals(response.headers.get('custom'), 'jt');

        cleanupResponses(response);
      });
      test(`headers added in controller middleware appear in the response`, async () => {
        server.controller(new OtherTestController((req, headers) => headers.set('custom', 'jt')));

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        assertEquals(response.headers.get('custom'), 'jt');

        cleanupResponses(response);
      });
      test(`a header set in controller middleware overrides the same one set in global middleware`, async () => {
        server.controller(new OtherTestController((req, headers) => headers.set('custom', 'jt')));
        server.globalMiddleware((req, headers) => headers.set('custom', 'global jt'));

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        assertEquals(response.headers.get('custom'), 'jt');

        cleanupResponses(response);
      });
      test(`a header set in the response of the controller's handler overrides the same one set in other middleware`, async () => {
        server.controller(new OtherTestController((req, headers) => headers.set('server-custom-header', 'jt')));
        server.globalMiddleware((req, headers) => headers.set('server-custom-header', 'global jt'));

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        assertEquals(response.headers.get('server-custom-header'), 'server');

        cleanupResponses(response);
      });
    });
  });

  describe('headers', () => {
    test(`custom headers are present`, async () => {
      server.controller(new OtherTestController());

      const response = await fetch(`${getBaseRoute()}/otherTest`);

      assertEquals(response.headers.get('server-custom-header'), 'server');

      cleanupResponses(response);
    });
  });

  test(`uses default response handler when provided`, async () => {
    server.defaultResponseHandler(() => new Response(undefined, { status: 401 }));

    const response = await fetch(`${getBaseRoute()}/nope`);

    assertEquals(response.status, 401);

    cleanupResponses(response);
  });
});

class OtherTestController extends Controller {
  constructor(...middleware: Middleware[]) {
    super({ base: '/otherTest', middleware: middleware });
  }

  'GET /': RequestHandler = (req) => {
    return new Response(undefined, {
      status: 200,
      headers: {
        'server-custom-header': 'server',
      },
    });
  };
}

class TestController extends Controller {
  constructor() {
    super({ base: '/test' });
  }

  'GET /': RequestHandler = (req) => {
    return new JsonResponse({ path: '/' }, { status: 200 });
  };

  'POST /': RequestHandler = (req) => {
    return new Response(undefined, { status: 201 });
  };

  'GET /some/path': RequestHandler = (req) => {
    return new JsonResponse({ path: '/some/path' }, { status: 200 });
  };

  'GET /has/a/path': RequestHandler = (req) => {
    return new JsonResponse({ path: '/has/a/path' }, { status: 200 });
  };

  'GET /has/a/path/:param': RequestHandler = (req) => {
    return new JsonResponse({ path: '/has/a/path/:param' }, { status: 200 });
  };

  'GET /users/:userId/messages/:messageId': RequestHandler = (req, params) => {
    return new JsonResponse({ path: '/users/:userId/messages/:messageId', params }, { status: 200 });
  };

  'GET /error': RequestHandler = (req) => {
    throw new TeapotError();
  };
}

async function cleanupResponses(...responses: Response[]) {
  for (const res of responses) {
    if (!res.bodyUsed) {
      await res.body?.cancel();
    }
  }
}
