import { assert, assertFalse } from 'assert';
import { describe, test } from 'bdd';
import { baseMatchesPath } from '../util.ts';

describe('util', () => {
  describe('baseMatchesPath', () => {
    describe(`true when...`, () => {
      test(`the path starts with the base`, () => {
        assert(baseMatchesPath('/api', '/api/some/path'));
      });
      test(`there is no base`, () => {
        assert(baseMatchesPath(undefined, '/something'));
        assert(baseMatchesPath('', '/something'));
      });
      test(`there is no base and the path is empty`, () => {
        assert(baseMatchesPath(undefined, ''));
        assert(baseMatchesPath('', '/'));
      });
      test(`the path is the base`, () => {
        assert(baseMatchesPath('/something', '/something'));
      });
      test(`the path matches a base with multiple parts`, () => {
        assert(baseMatchesPath('/api/v1', '/api/v1/something'));
      });
    });
    describe(`false when...`, () => {
      test(`the path does not contain with the base`, () => {
        assertFalse(baseMatchesPath('/api', '/something'));
      });
      test(`the path contains the base, but does not start with it`, () => {
        assertFalse(baseMatchesPath('/api', '/something/api'));
      });
    });
  });
});
