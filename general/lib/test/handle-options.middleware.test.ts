import { Controller, HttpMethod, HttpServer } from '@potami/core';
import { makeMiddlewareSubjects } from '@potami/testing';
import { assert } from 'assert';
import { describe, test } from 'bdd';
import { handleOptions } from '../handle-options.middleware.ts';

const BASE_URL = 'http://localhost:3000';

class TestController extends Controller {
  constructor() {
    super({ base: '/test' });
  }

  'POST /' = () => {};

  'GET /path' = () => {};
  'PUT /path' = () => {};
  'DELETE /path' = () => {};

  'GET /other/:param' = () => {};
  'POST /other/:param' = () => {};
}

const mockServerBuilder = new HttpServer.Builder().controller(new TestController());

describe('handleOptions', () => {
  test(`responds with no methods when the path isn't known`, async () => {
    assert(
      (
        await handleOptions()(
          makeMiddlewareSubjects({
            req: new Request(`${BASE_URL}/unknown`, { method: HttpMethod.Options }),
            server: mockServerBuilder.build(),
          })
        )
      )?.headers.get('allow') === ''
    );
  });
  test(`responds with no methods when the path has a controller, but the path doesn't have a handler`, async () => {
    assert(
      (
        await handleOptions()(
          makeMiddlewareSubjects({
            req: new Request(`${BASE_URL}/test/nope`, { method: HttpMethod.Options }),
            server: mockServerBuilder.build(),
          })
        )
      )?.headers.get('allow') === ''
    );
  });
  test(`responds with the single supported method when there's only one`, async () => {
    const response = await handleOptions()(
      makeMiddlewareSubjects({
        req: new Request(`${BASE_URL}/test`, { method: HttpMethod.Options }),
        server: mockServerBuilder.build(),
      })
    );

    assert(response?.headers.get('allow') === 'POST');
  });
  test(`responds with all supported methods when there are multiple`, async () => {
    const response = await handleOptions()(
      makeMiddlewareSubjects({
        req: new Request(`${BASE_URL}/test/path`, { method: HttpMethod.Options }),
        server: mockServerBuilder.build(),
      })
    );

    assert(response?.headers.get('allow')?.split(', ').length === 3);
    ['GET', 'PUT', 'DELETE'].forEach((method) => assert(response?.headers.get('allow')?.includes(method)));
  });
  test(`responds with all supported methods when there's a route param`, async () => {
    const response = await handleOptions()(
      makeMiddlewareSubjects({
        req: new Request(`${BASE_URL}/test/other/123`, { method: HttpMethod.Options }),
        server: mockServerBuilder.build(),
      })
    );

    assert(response?.headers.get('allow')?.split(', ').length === 2);
    ['GET', 'POST'].forEach((method) => assert(response?.headers.get('allow')?.includes(method)));
  });
  test(`status defaults to 200`, async () => {
    const response = await handleOptions()(
      makeMiddlewareSubjects({
        req: new Request(`${BASE_URL}/test/other/123`, { method: HttpMethod.Options }),
        server: mockServerBuilder.build(),
      })
    );

    assert(response?.status === 200);
    assert(response?.headers.get('allow')?.split(', ').length === 2);
    ['GET', 'POST'].forEach((method) => assert(response?.headers.get('allow')?.includes(method)));
  });
  test(`respects the configured successStatus if set`, async () => {
    const response = await handleOptions({ successStatus: 204 })(
      makeMiddlewareSubjects({
        req: new Request(`${BASE_URL}/test/other/123`, { method: HttpMethod.Options }),
        server: mockServerBuilder.build(),
      })
    );

    assert(response?.status === 204);
    assert(response?.headers.get('allow')?.split(', ').length === 2);
    ['GET', 'POST'].forEach((method) => assert(response?.headers.get('allow')?.includes(method)));
  });
  test(`has no response when the request isn't an OPTIONS request`, async () => {
    const response = await handleOptions()(
      makeMiddlewareSubjects({
        req: new Request(`${BASE_URL}/test/other/123`, { method: HttpMethod.Get }),
        server: mockServerBuilder.build(),
      })
    );

    assert(response === undefined);
  });
});
