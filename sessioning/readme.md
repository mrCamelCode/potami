# @potami/sessioning

Easily add secure support for sessioning to your Potami server. Simply configure and use the `handleSessioning` middleware and watch your server suddenly support persisted sessions!

## Example

```ts
type SessionData = { username: string };
type AppContext = SessionContext<SessionData>;

const kv = Deno.openKv();
const sessionStore = new KvSessionStore<SessionData>({ kvOptions: { kv }});

const server = new HttpServer<AppContext>();

server
  .base('/api') 
  .entryMiddleware(handleSessioning<SessionData, AppContext>({ store: sessionStore }))
  .start(3000);

```