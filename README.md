# Potamoi

A lightweight, simple, declarative HTTP server for Deno.

🚫 No black magic 🪄

🚫 No superfluous structure 🏢

🚫 No finger in all your pies 🥧

Potamoi is only as opinionated as it absolutely has to be. It seeks to give you what you need to make an HTTP server and then get out of your way.

## Getting Started with Hello World

Starting up an HTTP server with Potamoi is simple. Start by creating an `HttpServer`:

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

Potamoi attempts to only be opinionated about the things it _must_ be to do its job, and Potamoi's job is to ingest a request and get that request to a function that's meant to handle that type of request. You can think of Potamoi like a river; the request comes in, it flows through the river, and eventually it outputs a response. 

### Controllers

Controllers in Potamoi are the final destination and the most important piece. Controllers contain `RequestHandler`s that produce the actual `Response` that goes back to the client. `RequestHandler`s are named after the method and route they handle, meaning controllers handle wiring up your work and your routes all in one without any manual connections on your part. It's far from a blackbox, though--knowing what paths a controller can handle is immediately evident from a simple glance at its code. 

> If you look in the _Getting Started_ example above, it's immediately evident what methods and paths the `HelloController` can handle. Routes mean nothing without their corresponding handlers, so Potamoi colocates them.

All controllers must extend `Controller`:
```ts
class HelloController extends Controller {}
```
For every method and route your controller can handle, you specify a `RequestHandler`:
```ts
class HelloController extends Controller {
  constructor() {
    // The base of a controller differentiates it from other 
    // controllers in the application.
    super({ base: '/hello' });
  }

  'GET /': RequestHandler = (req) => {
    return new Response('Hello, world!', { status: 200 });
  };

  'GET /json': RequestHandler = (req) => {
    return new JsonResponse({ value: 'Hello, world!' }, { status: 200 });
  };

  'GET /greet/:name': RequestHandler = (req, { name }) => {
    return new Response(`Hello, ${name}!`, { status: 200 });
  }

  // ...
}
```
There's no black magic here. Specifying the `RequestHandler` type is just so the types of the function's params are properly inferred and you don't have to type them out. You could exclude the type if you prefer. Since classes in JS are just syntactic sugar for what essentially boils down to an object, it's a feature of the language that you can specify property names as strings. We're then just assigning that property to an anonymous function. Potamoi takes advantage of this language feature to establish semantic property names that correspond to handlers. Potamoi can then parse those semantic property names to understand the routing in the application. All that without any black magic directives or anything that requires a special compilation step. And, it makes your controllers self-documenting to boot!

That being said, the naming for a `RequestHandler` is one of the few places where Potamoi has an opinion. Any valid HTTP method is valid for a `RequestHandler`, but the handler _must_ be named in the format `METHOD /path`. The path must _always_ start with a `/`, and must _always_ be at least `/`.

Gladly, that's where the opinions end. What other helper or public methods, members, references, etc. that your controller has is totally up to you. Potamoi doesn't care.

One you've written your controller, you include it in your server:
```ts
const server = new HttpServer();

server.controller(new HelloController());
```
With that one method call, your controller and all its routes are hooked up and ready to go. Requests that come into the server will take that controller and its handlers into consideration.

### Middleware

Middleware is pretty handy, and Potamoi supports two kinds. There's global middleware that you can apply at the server level:
```ts
server.globalMiddleware((req, responseHeaders) => {...})
```
and there's middleware you can apply at the controller level:
```ts
class HelloController extends Controller {
  constructor() {
    super({ base: '/hello', middleware: [(req, responseHeaders) => {...}]});
  }
}
```
In both cases, a middleware is simply a function that receives the current request and a mutable reference to a `Headers` object. Your middleware can change that `Headers` object as needed. When the server sends a response, those headers are attached to the response. In the event multiple things touch the same headers, the last item in the flow to touch the header takes precedence. That will make more sense when we describe Flow later.

If your middleware determines something isn't right with the request, state of the server, etc., you can throw an `HttpError` to break from the regular flow and have Potamoi respond immediately without continuing its flow. There are a number of `HttpError` subclasses available for convenience, such as `BadRequestError`, `ServerError`, and of course, `TeapotError`. When Potamoi encounters an uncaught `HttpError`, it will send a response to the client with a status code that reflects the thrown error. For example, throwing a `BadRequestError` will yield a `400` response to the client.

In summary, middleware can be very handy. You can put a global middleware at the top of the chain that verifies incoming auth and breaks early if the auth is bad, you can attach CORS headers, custom proxying headers, forbid certain request paths under certain circumstances, etc. Just keep in mind that _no_ middleware runs if Potamoi doesn't find a suitable controller to handle the request. That leads us to our next topic: flow.

### Flow

In Potamoi, a request flows through in a consistent way for every request. Potamoi also tries to avoid doing any work it doesn't have to. The first thing Potamoi determines when a request enters the server is whether there's a controller that has a `RequestHandler` that can handle the request. If such a handler is present, Potamoi will begin the flow. If no handler exists, _no_ further processing happens and Potamoi returns the default response. If you want to customize what response Potamoi returns when it defaults, you can use the `HttpServer.defaultResponseHandler` method.

The full flow is:
1. Request enters.
1. Potamoi determines if it has a controller that can handle the request.
    * If no, returns the default response. Potamoi doesn't waste time processing a request it knows it can't handle.
    * If yes, continues through the flow.
1. General middleware runs.
1. The middleware for the controller that's going to handle the request runs.
1. The chosen `RequestHandler` in the handling controller runs and returns a `Response`.
1. The server forwards the `Response` along to the client.

Potamoi's flow is meant to be simple and predictable. There shouldn't be any surprises with how a `Response` ends up.