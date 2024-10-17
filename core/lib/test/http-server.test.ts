import { assert, assertEquals } from 'assert';
import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'bdd';
import { type Spy, assertSpyCalls, restore, spy, stub } from 'mock';
import { Controller } from '../controller.ts';
import { TeapotError } from '../errors/client/teapot.error.ts';
import { UnauthenticatedError } from '../errors/client/unauthenticated.error.ts';
import { HttpServer } from '../http-server.ts';
import type { Middleware, RequestHandler } from '../model.ts';
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
      describe('defaulting', () => {
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
        test(`invokes onDefault when there's no controller to handle the path`, async () => {
          const onDefaultSpy = spy();
          server.onDefault.subscribe(onDefaultSpy);

          const response = await fetch(`${getBaseRoute()}/nope`);

          assertSpyCalls(onDefaultSpy, 1);

          await cleanupResponses(response);
        });
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

      describe('defaulting', () => {
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
        test(`invokes onDefault when there's no controller to handle the path`, async () => {
          const onDefaultSpy = spy();
          server.onDefault.subscribe(onDefaultSpy);

          const response = await fetch(`${getBaseRoute()}/api/nope`);

          assertSpyCalls(onDefaultSpy, 1);

          await cleanupResponses(response);
        });
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

        await cleanupResponses(getResponse, postResponse);
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

        await cleanupResponses(responseWithoutParam, responseWithEmptyParam, responseWithParam);
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

      await cleanupResponses(response);
    });
  });

  describe('HTTP errors', () => {
    test(`an HTTP error thrown in a global middleware is caught and its status reflected in the response`, async () => {
      server.entryMiddleware(() => {
        throw new UnauthenticatedError('NONE SHALL PASS!');
      });

      const response = await fetch(`${getBaseRoute()}/test`);

      assertEquals(response.status, 401);

      await cleanupResponses(response);
    });
    test(`an HTTP error thrown in a controller middleware is caught and its status reflected in the response`, async () => {
      server.controller(
        new OtherTestController(() => {
          throw new UnauthenticatedError('NONE SHALL PASS!');
        })
      );

      const response = await fetch(`${getBaseRoute()}/otherTest`);

      assertEquals(response.status, 401);

      await cleanupResponses(response);
    });
    test(`an HTTP error thrown in a request handler is caught and its status reflected in the response`, async () => {
      const response = await fetch(`${getBaseRoute()}/test/error`);

      assertEquals(response.status, 418);

      await cleanupResponses(response);
    });
    test(`onError is invoked when there's an error`, async () => {
      const onErrorSpy = spy();

      server.onError.subscribe(onErrorSpy);

      const response = await fetch(`${getBaseRoute()}/test/error`);

      assert(onErrorSpy.calls[0].args[0] instanceof TeapotError);

      await cleanupResponses(response);
    });
  });

  describe('middleware', () => {
    describe('entry middleware', () => {
      test(`runs in order when the server can handle the request`, async () => {
        const calledMiddleware: number[] = [];
        const middleware = [
          spy(() => {
            calledMiddleware.push(0);
          }),
          spy(() => {
            calledMiddleware.push(1);
          }),
        ];

        server.entryMiddleware(...middleware);

        const response = await fetch(`${getBaseRoute()}/test`);

        middleware.forEach((m) => {
          assert(m.calls.length === 1);
        });

        assertEquals(calledMiddleware[0], 0);
        assertEquals(calledMiddleware[1], 1);

        await cleanupResponses(response);
      });
      test(`runs in order when the server can't handle the request`, async () => {
        const calledMiddleware: number[] = [];
        const middleware = [
          spy(() => {
            calledMiddleware.push(0);
          }),
          spy(() => {
            calledMiddleware.push(1);
          }),
        ];

        server.entryMiddleware(...middleware);

        const response = await fetch(`${getBaseRoute()}/nope`);

        middleware.forEach((m) => {
          assert(m.calls.length === 1);
        });

        assertEquals(calledMiddleware[0], 0);
        assertEquals(calledMiddleware[1], 1);

        await cleanupResponses(response);
      });
      test(`async entry middleware is called in order`, async () => {
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

        server.entryMiddleware(...middleware);

        const response = await fetch(`${getBaseRoute()}/test`);

        middleware.forEach((m) => {
          assert(m.calls.length === 1);
        });

        assertEquals(calledMiddleware[0], 0);
        assertEquals(calledMiddleware[1], 1);

        await cleanupResponses(response);
      });
      test(`if a middleware returns a response, further processing is foregone and the response is sent to the client`, async () => {
        const middleware = [
          spy(() => {}),
          spy(() => {
            return new Response(undefined, { status: 418 });
          }),
          spy(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }),
        ];

        server.entryMiddleware(...middleware);

        const response = await fetch(`${getBaseRoute()}/test`);

        assertEquals(middleware[0].calls.length, 1);
        assertEquals(middleware[1].calls.length, 1);
        assertEquals(middleware[2].calls.length, 0);
        assertEquals(response.status, 418);

        await cleanupResponses(response);
      });
    });
    describe('controller middleware', () => {
      test(`runs in order when the server can handle the request`, async () => {
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

        await cleanupResponses(response);
      });
      test(`doesn't run when the server can't handle the request`, async () => {
        const calledMiddleware: number[] = [];
        const entryMiddleware = [
          spy(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));

            calledMiddleware.push(10);
          }),
          spy(() => {
            calledMiddleware.push(20);
          }),
        ];
        const controllerMiddleware = [
          spy(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));

            calledMiddleware.push(0);
          }),
          spy(() => {
            calledMiddleware.push(1);
          }),
        ];

        server.controller(new OtherTestController(...controllerMiddleware));
        server.entryMiddleware(...entryMiddleware);

        const response = await fetch(`${getBaseRoute()}/nope`);

        controllerMiddleware.forEach((m) => {
          assert(m.calls.length === 0);
        });

        assertEquals(calledMiddleware.length, 2);
        assertEquals(calledMiddleware[0], 10);
        assertEquals(calledMiddleware[1], 20);

        await cleanupResponses(response);
      });
      test(`async controller middleware is called in order`, async () => {
        const middleware = [
          spy(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }),
          spy(() => {}),
        ];

        server.controller(new OtherTestController(...middleware));

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        middleware.forEach((m) => {
          assert(m.calls.length === 1);
        });

        middleware.forEach((m) => assertEquals(m.calls.length, 1));

        await cleanupResponses(response);
      });
      test(`if a middleware returns a response, further processing is foregone and the response is sent to the client`, async () => {
        const middleware = [
          spy(() => {}),
          spy(() => {
            return new Response(undefined, { status: 418 });
          }),
          spy(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }),
        ];

        server.controller(new OtherTestController(...middleware));

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        assertEquals(middleware[0].calls.length, 1);
        assertEquals(middleware[1].calls.length, 1);
        assertEquals(middleware[2].calls.length, 0);
        assertEquals(response.status, 418);

        await cleanupResponses(response);
      });
    });

    describe('headers', () => {
      test(`headers added in global middleware appear in the response`, async () => {
        server.entryMiddleware(({ resHeaders }) => resHeaders.set('custom', 'jt'));

        const response = await fetch(`${getBaseRoute()}/test`);

        assertEquals(response.headers.get('custom'), 'jt');

        await cleanupResponses(response);
      });
      test(`headers added in controller middleware appear in the response`, async () => {
        server.controller(new OtherTestController(({ resHeaders }) => resHeaders.set('custom', 'jt')));

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        assertEquals(response.headers.get('custom'), 'jt');

        await cleanupResponses(response);
      });
      test(`a header set in controller middleware overrides the same one set in global middleware`, async () => {
        server.controller(new OtherTestController(({ resHeaders }) => resHeaders.set('custom', 'jt')));
        server.entryMiddleware(({ resHeaders }) => resHeaders.set('custom', 'global jt'));

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        assertEquals(response.headers.get('custom'), 'jt');

        await cleanupResponses(response);
      });
      test(`a header set in the response of the controller's handler overrides the same one set in other middleware`, async () => {
        server.controller(new OtherTestController(({ resHeaders }) => resHeaders.set('server-custom-header', 'jt')));
        server.entryMiddleware(({ resHeaders }) => resHeaders.set('server-custom-header', 'global jt'));

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        assertEquals(response.headers.get('server-custom-header'), 'server');

        await cleanupResponses(response);
      });
      test(`a header set in the response of the controller is present alongside those set in middleware`, async () => {
        server.controller(new OtherTestController(({ resHeaders }) => resHeaders.set('custom-header', 'jt')));
        server.entryMiddleware(({ resHeaders }) => resHeaders.set('another-custom-header', 'global jt'));

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        assertEquals(response.headers.get('server-custom-header'), 'server');
        assertEquals(response.headers.get('custom-header'), 'jt');
        assertEquals(response.headers.get('another-custom-header'), 'global jt');

        await cleanupResponses(response);
      });
      test(`a header set in the repsonse of a middleware is present alongside those set in other middleware`, async () => {
        server.entryMiddleware(
          ({ resHeaders }) => resHeaders.set('custom-header', 'jt'),
          () => new Response(undefined, { headers: { 'other-header': 'response-header' } })
        );

        const response = await fetch(`${getBaseRoute()}/otherTest`);

        assertEquals(response.headers.get('other-header'), 'response-header');
        assertEquals(response.headers.get('custom-header'), 'jt');

        await cleanupResponses(response);
      });
    });
  });

  describe('headers', () => {
    test(`custom headers are present`, async () => {
      server.controller(new OtherTestController());

      const response = await fetch(`${getBaseRoute()}/otherTest`);

      assertEquals(response.headers.get('server-custom-header'), 'server');

      await cleanupResponses(response);
    });
  });

  describe('onBeforeRespond', () => {
    describe('invokes onBeforeRespond...', () => {
      let onBeforeRespondSpy: Spy;
      beforeEach(() => {
        onBeforeRespondSpy = spy();
        server.onBeforeRespond.subscribe(onBeforeRespondSpy);
      });

      test('when the server can handle the path', async () => {
        const response = await fetch(`${getBaseRoute()}/has/a/path`);

        assertSpyCalls(onBeforeRespondSpy, 1);

        await cleanupResponses(response);
      });
      test(`when the server can't handle the path`, async () => {
        const response = await fetch(`${getBaseRoute()}/nope`);

        assertSpyCalls(onBeforeRespondSpy, 1);

        await cleanupResponses(response);
      });
      test(`when the server encounters an error`, async () => {
        const response = await fetch(`${getBaseRoute()}/error`);

        assertSpyCalls(onBeforeRespondSpy, 1);

        await cleanupResponses(response);
      });
    });
  });

  describe('stopping the server', () => {
    test('stop', async () => {
      const server = new HttpServer();

      await server.start(3000);
      // If this doesn't work, Deno will complain about leaking resources.
      await server.stop();
    });
    test('abort', async () => {
      const server = new HttpServer();

      await server.start(3000);
      // If this doesn't work, Deno will complain about leaking resources.
      await server.abort();
    });
  });

  test(`uses default response handler when provided`, async () => {
    server.defaultResponseHandler(() => new Response(undefined, { status: 401 }));

    const response = await fetch(`${getBaseRoute()}/nope`);

    assertEquals(response.status, 401);

    await cleanupResponses(response);
  });
});

class OtherTestController extends Controller {
  constructor(...middleware: Middleware[]) {
    super({ base: '/otherTest', middleware: middleware });
  }

  'GET /': RequestHandler = () => {
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

  'GET /': RequestHandler = () => {
    return new JsonResponse({ path: '/' }, { status: 200 });
  };

  'POST /': RequestHandler = () => {
    return new Response(undefined, { status: 201 });
  };

  'GET /some/path': RequestHandler = () => {
    return new JsonResponse({ path: '/some/path' }, { status: 200 });
  };

  'GET /has/a/path': RequestHandler = () => {
    return new JsonResponse({ path: '/has/a/path' }, { status: 200 });
  };

  'GET /has/a/path/:param': RequestHandler = () => {
    return new JsonResponse({ path: '/has/a/path/:param' }, { status: 200 });
  };

  'GET /users/:userId/messages/:messageId': RequestHandler = ({ params }) => {
    return new JsonResponse({ path: '/users/:userId/messages/:messageId', params }, { status: 200 });
  };

  'GET /error': RequestHandler = () => {
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
