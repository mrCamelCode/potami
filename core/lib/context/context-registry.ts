import type { Context } from './context.ts';

// deno-lint-ignore ban-types
export type ContextScopeIdentifier = string | Function;

export class ContextRegistration<T = unknown> {
  #value: T | undefined;
  #scopes: Map<ContextScopeIdentifier, ContextRegistration<T>>;

  get value(): T | undefined {
    return this.#value;
  }
  set value(val) {
    this.#value = val;
  }

  constructor(value?: T) {
    this.#value = value;
    this.#scopes = new Map();
  }

  hasScope(id: ContextScopeIdentifier): boolean {
    return this.#scopes.has(id);
  }

  getScope(id: ContextScopeIdentifier): ContextRegistration | undefined {
    return this.#scopes.get(id);
  }

  addScope(id: ContextScopeIdentifier, value?: T): ContextRegistration {
    const registration = new ContextRegistration(value);

    this.#scopes.set(id, registration);

    return registration;
  }

  removeScope(id: ContextScopeIdentifier): void {
    this.#scopes.delete(id);
  }
}

export class ContextRegistry {
  #contexts: Record<Context['id'], ContextRegistration> = {};

  register<T>(context: Context<T>, value: T, ...scopeIds: ContextScopeIdentifier[]): void {
    if (!this.#getRootRegistration(context)) {
      this.#contexts[context.id] = new ContextRegistration();
    }

    this.#registerRecursively(value, this.#getRootRegistration(context)!, ...scopeIds);
  }

  getContext<T>(context: Context<T>, ...scopeIds: ContextScopeIdentifier[]): T {
    const root = this.#getRootRegistration(context);

    let scope: ContextRegistration | undefined = root;
    let lastDefinedScopeValue = root?.value;
    for (const scopeId of scopeIds) {
      lastDefinedScopeValue = scope?.value ?? lastDefinedScopeValue;

      if (scope?.hasScope(scopeId)) {
        scope = scope.getScope(scopeId)!;
      } else {
        break;
      }
    }

    return (scope?.value ?? lastDefinedScopeValue ?? context.defaultValue) as T;
  }

  removeScope<T>(context: Context<T>, ...scopeIds: ContextScopeIdentifier[]): void {
    const root = this.#getRootRegistration(context);
    const isRemovingRoot = scopeIds.length === 0;

    if (isRemovingRoot) {
      delete this.#contexts[context.id];
    } else if (root) {
      this.#removeRecursively(root, ...scopeIds);
    }
  }

  #registerRecursively<T>(value: T, currentScope: ContextRegistration, ...scopeIds: ContextScopeIdentifier[]): void {
    const nextScopeId = scopeIds[0];
    const nextScopeExists = currentScope.hasScope(nextScopeId);

    if (!nextScopeId) {
      currentScope.value = value;
    } else {
      this.#registerRecursively(
        value,
        nextScopeExists ? currentScope.getScope(nextScopeId)! : currentScope.addScope(nextScopeId),
        ...scopeIds.slice(1)
      );
    }
  }

  #removeRecursively(currentScope: ContextRegistration, ...scopeIds: ContextScopeIdentifier[]): void {
    const nextScopeId = scopeIds[0];

    if (scopeIds.length === 1) {
      currentScope.removeScope(nextScopeId);
    } else if (currentScope.hasScope(nextScopeId)) {
      this.#removeRecursively(currentScope.getScope(nextScopeId)!, ...scopeIds.slice(1));
    } else {
      // Abort if any part of the scope path is invalid.
      return;
    }
  }

  #getRootRegistration<T>(context: Context<T>): ContextRegistration | undefined {
    return this.#contexts[context.id];
  }
}
