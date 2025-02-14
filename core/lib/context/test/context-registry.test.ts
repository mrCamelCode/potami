import { assertEquals } from 'assert';
import { beforeEach, describe, test } from 'bdd';
import { ContextRegistry } from '../context-registry.ts';
import { Context } from '../context.ts';

type TestContextValue = number;

describe('ContextRegistry', () => {
  let registry: ContextRegistry;
  let ctx: Context<TestContextValue>;
  beforeEach(() => {
    registry = new ContextRegistry();
    ctx = new Context<TestContextValue>(0);
  });

  describe('registration/retrieval', () => {
    test(`the context's default value is returned when it's never been registered`, () => {
      assertEquals(registry.getContext(ctx), 0);
    });
    test(`the context's default value is returned when it's never been registered and a nested scope is requested`, () => {
      assertEquals(registry.getContext(ctx, 'nested1', 'nested2'), 0);
    });
    test(`can retrieve the root registered context`, () => {
      registry.register(ctx, 123);

      assertEquals(registry.getContext(ctx), 123);
    });
    test(`can retrieve a scoped context`, () => {
      registry.register(ctx, 321, 'nested1');

      assertEquals(registry.getContext(ctx, 'nested1'), 321);
    });
    test(`can retrieve a nested scope`, () => {
      registry.register(ctx, 1234, 'nested1', 'nested2');

      assertEquals(registry.getContext(ctx, 'nested1', 'nested2'), 1234);
    });
    test(`the root context is returned when getting a scope when there are no scopes`, () => {
      registry.register(ctx, 123);

      assertEquals(registry.getContext(ctx, 'nested1', 'nested2', 'nested3'), 123);
    });
    test(`creating multiple scopes at the root doesn't remove data`, () => {
      registry.register(ctx, 123);
      registry.register(ctx, 321, 'scope');
      registry.register(ctx, 10, 'scope2');

      assertEquals(registry.getContext(ctx), 123);
      assertEquals(registry.getContext(ctx, 'scope'), 321);
      assertEquals(registry.getContext(ctx, 'scope2'), 10);
    });
    test(`creating multiple nested scopes doesn't remove data`, () => {
      registry.register(ctx, 123);
      registry.register(ctx, 321, 'scope');
      registry.register(ctx, 10, 'scope2');

      registry.register(ctx, 100, 'scope', 'inner');
      registry.register(ctx, 200, 'scope3', 'inner', 'inner');

      assertEquals(registry.getContext(ctx), 123);
      assertEquals(registry.getContext(ctx, 'scope'), 321);
      assertEquals(registry.getContext(ctx, 'scope2'), 10);
      assertEquals(registry.getContext(ctx, 'scope', 'inner'), 100);
      assertEquals(registry.getContext(ctx, 'scope3', 'inner', 'inner'), 200);
    });
    test(`the root context is returned when getting a scope that doesn't exist`, () => {
      registry.register(ctx, 123);
      registry.register(ctx, 321, 'nested1');

      assertEquals(registry.getContext(ctx, 'nope'), 123);
    });
    test(`the closest context with a value is returned when getting a nested scope that doesn't exist`, () => {
      registry.register(ctx, 123);
      registry.register(ctx, 321, 'scope');
      registry.register(ctx, 10, 'scope2');

      registry.register(ctx, 100, 'scope', 'inner');
      registry.register(ctx, 200, 'scope3', 'inner', 'inner');

      assertEquals(registry.getContext(ctx, 'scope', 'nope', 'another'), 321);
      assertEquals(registry.getContext(ctx, 'scope', 'inner', 'another'), 100);
      assertEquals(registry.getContext(ctx, 'scope3', 'nope', 'another'), 123);
    });
    test(`the default value is returned when the root has no value to fallback on`, () => {
      registry.register(ctx, 321, 'scope');
      registry.register(ctx, 10, 'scope2');

      registry.register(ctx, 100, 'scope', 'inner');
      registry.register(ctx, 200, 'scope3', 'inner', 'inner');

      assertEquals(registry.getContext(ctx, 'scope3', 'nope', 'another'), 0);
    });
  });

  describe('removal', () => {
    test(`can remove the root to delete the context entirely`, () => {
      registry.register(ctx, 100);

      registry.removeScope(ctx);

      assertEquals(registry.getContext(ctx), 0);
    });
    test(`can remove a single nesting`, () => {
      registry.register(ctx, 100);
      registry.register(ctx, 200, 'inner');

      registry.removeScope(ctx, 'inner');

      assertEquals(registry.getContext(ctx, 'inner'), 100);
      assertEquals(registry.getContext(ctx), 100);
    });
    test(`can remove two nestings`, () => {
      registry.register(ctx, 100);
      registry.register(ctx, 200, 'inner');
      registry.register(ctx, 300, 'inner', 'inner');

      registry.removeScope(ctx, 'inner', 'inner');

      assertEquals(registry.getContext(ctx, 'inner', 'inner'), 200);
      assertEquals(registry.getContext(ctx, 'inner'), 200);
      assertEquals(registry.getContext(ctx), 100);
    });
    test(`removing a nesting that had nestings and removes the inner nestings`, () => {
      registry.register(ctx, 100);
      registry.register(ctx, 200, 'inner');
      registry.register(ctx, 300, 'inner', 'inner');
      registry.register(ctx, 400, 'inner', 'inner', 'another');
      registry.register(ctx, 500, 'inner', 'inner', 'another', 'another');

      registry.removeScope(ctx, 'inner', 'inner', 'another');

      assertEquals(registry.getContext(ctx, 'inner', 'inner', 'another', 'another'), 300);
      assertEquals(registry.getContext(ctx, 'inner', 'inner', 'another'), 300);
      assertEquals(registry.getContext(ctx, 'inner', 'inner'), 300);
      assertEquals(registry.getContext(ctx, 'inner'), 200);
      assertEquals(registry.getContext(ctx), 100);
    });
    test(`removing a non-existent path does nothing`, () => {
      registry.register(ctx, 100);

      registry.removeScope(new Context('123'));

      assertEquals(registry.getContext(ctx), 100);
    });
    test(`removing a non-existent scope on a path with correct parts does nothing`, () => {
      registry.register(ctx, 100);
      registry.register(ctx, 200, 'inner');
      registry.register(ctx, 300, 'inner', 'inner');
      registry.register(ctx, 400, 'inner', 'inner', 'another');
      registry.register(ctx, 500, 'inner', 'inner', 'another', 'another');

      registry.removeScope(ctx, 'inner', 'inner', 'nope');

      assertEquals(registry.getContext(ctx, 'inner', 'inner', 'another', 'another'), 500);
      assertEquals(registry.getContext(ctx, 'inner', 'inner', 'another'), 400);
      assertEquals(registry.getContext(ctx, 'inner', 'inner'), 300);
      assertEquals(registry.getContext(ctx, 'inner'), 200);
      assertEquals(registry.getContext(ctx), 100);
    });
  });
});
