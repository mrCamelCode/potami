# Potamoi

A lightweight, declarative, low-boilerplate HTTP server for Deno. Potamoi is only as opinionated as it absolutely has to be.

## Getting Started with Hello World

Starting up an HTTP with Potamoi is simple. Start by creating an `HttpServer`:

```ts
const server = new HttpServer();
```

The `HttpServer` has a number of chaining methods that allow you to configure the server and bootstrap it. Once everything's configured, you can simply `start` the server:

```ts
class HelloController extends Controller {
  constructor() {
    super({ base: '/hello' });
  }

  'GET /': RequestHandler = (req) => {
    return new Response('Hello world!', { status: 200 });
  }
}

const server = new HttpServer();

server
  .base('/api') 
  .controller(new HelloController())
  .start(3000);
```

That smidge of code produces a server that listens on port 3000 that will respond with a text response of `"Hello world!"` if you send a `GET` request to `/api/hello`. Easy!

## The Bits and Bobs

Potamoi attempts to only be opinionated about the things it _must_ be to do its job, and Potamoi's job is to ingest a request and get that request to a function that's going to send a response. You can think of Potamoi like a river; the request comes in, it flows through the river, and eventually it outputs a response. 

### Controllers

Controllers in Potamoi are the final destination. Controllers contain `RequestHandler`s that produce the actual `Response` that goes back to the client. `RequestHandler`s are also named after the method and route they handle, meaning controllers handle wiring up your work and your routes all in one without any manual connections on your part. It's far from a blackbox, though--knowing what paths a controller can handle is immediately evident from a simple glance at its code.

All controllers must extend `Controller`:
```ts
class HelloController extends Controller {}
```
