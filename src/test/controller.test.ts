import { assertEquals } from 'assert';
import { describe, test } from 'bdd';
import { Controller } from '../controller.ts';

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
});
