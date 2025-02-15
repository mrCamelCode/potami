import { assert, assertEquals } from 'assert';
import { describe, test } from 'bdd';
import { Controller } from '../controller.ts';
import type { RequestHandler } from '../model.ts';

describe('Controller', () => {
  describe('getSearchParams', () => {
    test(`returns the search params`, () => {
      const params = Controller.getSearchParams(
        new Request('http://localhost:8080/something?num=123&bool=true&something=else')
      );

      assertEquals(params.get('num'), '123');
      assertEquals(params.get('bool'), 'true');
      assertEquals(params.get('something'), 'else');
    });
    test(`doesn't explode when there are no search params`, () => {
      const params = Controller.getSearchParams(new Request('http://localhost:8080/something'));

      assertEquals([...params.keys()].length, 0);
    });
  });
  describe('getRequestHandlerNamesForPath', () => {
    test(`empty array when there are no handlers for the path`, () => {
      const controller = new TestController();

      const result = controller.getRequestHandlerNamesForPath('/test');

      assertEquals(result.length, 0);
    });
    test(`returns all handler names for a simple path with multiple methods`, () => {
      const controller = new TestController();

      const result = controller.getRequestHandlerNamesForPath('/test/something');

      assertEquals(result.length, 3);
      assert(['GET /something', 'POST /something', 'PUT /something'].every((name) => result.includes(name)));
    });
    test(`returns one handler name when there's only one match`, () => {
      const controller = new TestController();

      const result = controller.getRequestHandlerNamesForPath('/test/lonely');

      assertEquals(result.length, 1);
      assert(['GET /lonely'].every((name) => result.includes(name)));
    });
    test(`returns one handler name when there's only one match for a path with a param`, () => {
      const controller = new TestController();

      const result = controller.getRequestHandlerNamesForPath('/test/something/test');

      assertEquals(result.length, 1);
      assert(['GET /something/:param'].every((name) => result.includes(name)));
    });
    test(`returns all handler names for a path with multiple pieces`, () => {
      const controller = new TestController();

      const result = controller.getRequestHandlerNamesForPath('/test/different/endpoint');

      assertEquals(result.length, 2);
      assert(['POST /different/endpoint', 'DELETE /different/endpoint'].every((name) => result.includes(name)));
    });
    test(`returns all handler names for a path with multiple pieces and params`, () => {
      const controller = new TestController();

      const result = controller.getRequestHandlerNamesForPath('/test/path/123/and/something/end');

      assertEquals(result.length, 2);
      assert(
        ['GET /path/:param1/and/:param2/end', 'POST /path/:param1/and/:param2/end'].every((name) =>
          result.includes(name)
        )
      );
    });
  });
});

class TestController extends Controller {
  constructor() {
    super({ base: '/test' });
  }

  'GET /something': RequestHandler = () => {
    return new Response();
  };
  'POST /something': RequestHandler = () => {
    return new Response();
  };
  'PUT /something': RequestHandler = () => {
    return new Response();
  };

  'GET /lonely': RequestHandler = () => {
    return new Response();
  };

  'GET /something/:param': RequestHandler = () => {
    return new Response();
  };

  'POST /different/endpoint': RequestHandler = () => {
    return new Response();
  };
  'DELETE /different/endpoint': RequestHandler = () => {
    return new Response();
  };

  'GET /path/:param1/and/:param2/end': RequestHandler = () => {
    return new Response();
  };
  'POST /path/:param1/and/:param2/end': RequestHandler = () => {
    return new Response();
  };
}
