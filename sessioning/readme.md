# @potami/sessioning

Easily add secure support for sessioning to your Potami server. Simply configure and use the `handleSessioning` middleware and watch your server suddenly support persisted sessions!

## Example

```ts
type SessionData = { username: string };

const kv = Deno.openKv();
const sessionStore = new KvSessionStore<SessionData>({ kvOptions: { kv } });
const sessionContext = new Context(getDefaultSessionContext());

const serverBuilder = new HttpServer.Builder();

serverBuilder
  .base('/api')
  .entryMiddleware(handleSessioning<SessionData>({ store: sessionStore, sessionContext }))
  .build()
  .start(3000);
```
