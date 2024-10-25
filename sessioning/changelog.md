# 0.2.0

## Breaking Changes

- The `KvSessionStore` no longer accepts a `refreshWindowMs`. After a session has surpassed its TTL, it's expired. Only unexpired sessions may be refreshed.
- The `ISessionStore` interface now includes a `refreshSession` method.

## Other Changes

- The `KvSessionStore`'s `ttlMs` now defaults to 30 minutes (was 2 hours).
  - This change was made to be more in line with the default that a session is refreshed whenever a request is made to the server. The default configuration is intended for apps where a user is somewhat frequently interacting with the backend and extended instances of inactivity typically indicate the user has left.

# 0.1.0
  - Released package.
