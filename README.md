# Potami

Potami (from the Greek ποτάμι, /poh-TAH-mee/) is a lightweight, simple, declarative HTTP server for Deno.

🚫 No black magic 🪄

🚫 No superfluous structure 🏢

🚫 No finger in all your pies 🥧

Potami is only as opinionated as it absolutely has to be. It gives you what you need to make an HTTP server and then gets out of your way.

## Getting Started with Hello World

Starting up an HTTP server with Potami is simple. Start by creating an `HttpServer`:

```ts
const server = new HttpServer();
```

The `HttpServer` has a number of chaining methods that allow you to configure the server and bootstrap it. Configuration is done via chaining on an instance instead of being magically picked up from some arbitrarily-named config file with some arbitrary JSON format.

Once everything's configured, you can simply `start` the server:

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

Potami attempts to only be opinionated about the things it _must_ be to do its job. Potami's job is to ingest a request and get that request to a function that will handle it. That's it.

You can think of Potami like a river; the request comes in, it flows through the river, and eventually it outputs a response. 

### Flow

Potami's flow is meant to be simple and predictable. When a request enters the server, the server's `entryMiddleware` run against it. After that, Potami determines whether there's a controller that has a `RequestHandler` that can handle the request. 

If such a handler is present, Potami runs that controller's middleware, and ultimately calls the determined `RequestHandler` to produce the `Response` that Potami will give to the client.

If no handler can be found, Potami returns a default response. If you want to customize what response Potami returns when it defaults, you can use the `HttpServer.defaultResponseHandler` method.

### Controllers

Controllers in Potami are responsible for defining paths known to the server and how to handle them, and they're very important to Potami's job. Controllers contain `RequestHandler`s that produce the `Response`s that go back to the client. `RequestHandler`s are named after the method and route they handle, meaning controllers handle defining your handlers _and_ your routes all in one. It's far from a blackbox, though--knowing what paths a controller can handle is immediately evident from a simple glance at its code. 

> If you look in the _Getting Started_ example above, it's obvious what methods and paths the `HelloController` can handle. Routes mean nothing without their corresponding handlers, so Potami colocates them.

All controllers must extend `Controller`:
```ts
class HelloController extends Controller {}
```
For every method and route your controller can handle, you specify a `RequestHandler`:
```ts
class HelloController extends Controller {
  constructor() {
    // The base of a controller differentiates it from other 
    // controllers in the application and defines the base route
    // for the controller.
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
There's no black magic here. Specifying the `RequestHandler` type is just so the types of the function's params are properly inferred and you don't have to type them out. You could exclude the type if you prefer. 

Classes in JS are just syntactic sugar for what essentially boils down to a regular object (with some extra stuff we don't care about in this context). In JS, object properties can be any string. Potami takes advantage of this language feature to establish a convention for semantic property names. The values of these properties correspond to handlers. Potami can then parse those semantic property names to understand the routing in the application. All that without any black magic directives or anything that requires a special compilation step. And, it makes your controllers self-documenting to boot!

Importantly, the naming for a `RequestHandler` is one of the few places where Potami has an opinion. Any valid HTTP method is valid for a `RequestHandler`, but the handler _must_ be named in the format `METHOD /path`. The path must _always_ start with a `/`, and must _always_ be at least `/`.

Gladly, that's where the opinions end. What other methods, members, references, etc. that your controller has is totally up to you. Potami doesn't care.

Once you've written your controller, you include it in your server:
```ts
const server = new HttpServer();

server.controller(new HelloController());
```
With that one method call, your controller and all its routes are hooked up and ready to go. Requests that come into the server will take that controller and its handlers into consideration when determining where to send the request for handling.

### Middleware

Middleware is pretty handy, and Potami supports two kinds. There's **Entry Middleware** that you can apply at the server level:
```ts
server.entryMiddleware(({ req, resHeaders }) => {...})
```
and there's **Controller Middleware**  you can apply at the controller level:
```ts
class HelloController extends Controller {
  constructor() {
    super({ base: '/hello', middleware: [({ req, resHeaders }) => {...}]});
  }
}
```
In both cases, a middleware is simply a function that receives a number of subjects and either returns nothing or returns a `Response`. Among the subjects provided to a middleware are the current request and a mutable reference to a `Headers` object. **Middleware can be async or sync.**

#### Setting Headers in Middleware
Your middleware can change the `Headers` object it receives as needed. When the server sends the response, those headers are attached to the response. In the event multiple things touch the same header, the last item in the flow to touch the header takes precedence.

#### A Middleware's Return
A middleware's return can either be `void` or a `Response` (or a `Promise`-wrapped version of those, since middleware may be sync or async). In most cases, **you should prefer returning nothing from your middleware**. Your server will be more predictable if you limit the number of cases you introduce into your application that cause the typical flow to fork and respond early. As much as you can, you should delegate `Response` generation to your controllers.

That being said, there are use cases for letting a middleware handle a request and generate a `Response`. Such cases include, but aren't limited to:
1. Generating a response for a request where the path is irrelevant. A common example would be something like an `Upgrade` request sent when trying to start a `WebSocket`. In this case, the path isn't necessarily relevant; your server could catch any request that includes the `Upgrade: websocket` header and perform the upgrade.
1. Generating a response for a request that asks for information about the server. A common example would be a middleware that handles responding to `OPTIONS` requests. Such a middleware could analyze the state of the `HttpServer` instance that it's running in to determine what methods are supported by the requester's path. Middleware can do this because one of the subjects it receives is an immutable reference to the `HttpServer` instance that the middleware is running in.

#### Breaking from Middleware

While you can send a `Response` to break from the regular flow and respond early, you may find it more semantic to use errors in the event something is wrong with the request. If your middleware determines something isn't right, you can throw an `HttpError` to break from the regular flow and have Potami respond immediately. There are a number of `HttpError` subclasses available for convenience, such as `BadRequestError`, `ServerError`, and of course, `TeapotError`. When Potami encounters an uncaught `HttpError`, it will send a response to the client with a status code that reflects the thrown error. For example, throwing a `BadRequestError` will yield a `400` response to the client. 

#### Middleware Execution Order

Any middleware can be sync or async, but in either case Potami guarantees that the middleware will run _in the order provided_. If a particular middleware in a chain is async, Potami will wait for it to complete before moving on, even if other middleware in the chain are sync. That means in a situation like this:
```ts
server
  .entryMiddleware(checkAuth, rateLimit, talkToDb, attachAppHeaders)
```
where `talkToDb` is asynchronous, Potami will wait for `talkToDb` to finish before invoking `attachAppHeaders`. This improves predictability and consistency. It also allows you to put the _most_ important things first. 

In this case, we `checkAuth` before doing anything else. That middleware may throw a `ForbiddenError` or an `UnauthenticatedError` in the event there's something wrong with the `Authorization` on the request. Because Potami guarantees order, you can be confident that a request won't flow through the rest of your server if it can't pass your important validation middleware.

### Testability

Potami embraces testability. Because Potami has a focused set of concerns and doesn't have a lot of opinions about your application as a whole, it doesn't make a lot of assumptions. The result is that Potami doesn't try to design the world and sticks to basic, testable mechanisms. In the purest sense, Potami is a library, **not a framework**. 

No black magic injections, providers, wiring, etc. 

Making sure the elements of your Potami application work is as easy as writing unit tests against functions because the `RequestHandler`s and middleware that make up an application using Potami are _just functions_. As a rule, Potami doesn't need any special mocking utilities because there's _no black magic_. Everything is plainly given to `RequestHandler`s and middleware via function args, which means you can easily control what gets passed in a testing environment.

#### Testing Controllers

Controllers are just classes with methods in them. They don't have to go through any compilation to be useful. Since controllers receive the request and any route params, you can easily mock or stub out what's given to the controller to assert on its behaviour in a variety of situations.

In other server solutions, it's common to use Services to move work out of your controllers. Other solutions may have a lot of opinions and structure around including Services in your application.

You can choose to have Services or not; Potami doesn't care. Potami doesn't need to know about your Services to do its job, so it doesn't need to care about them. 

However, if you _do_ choose to use Services that you invoke in your controllers' `RequestHandler`s, you'll find your controllers remain testable if you provide instances of your Services to your controllers when constructing them. That allows you to easily mock the Service's instance in the tests for your controller. An example would look like:
```ts
class UserService {
  getUser(userId: string) {...}
}

class UserController extends Controller {
  constructor(private _userService: UserService) {
    super({ base: '/users' });
  }

  'GET /:userId': RequestHandler = (req, { userId }) => {
    const user = this._userService.getUser(userId);

    // ...
  };
}
```

When you instantiate the controller in a test suite to test it, you simply give it a mocked version of the service using your chosen mocking solution:
```ts
const mockedUserService: UserService = makeUserServiceMock();

const controller = new UserController(mockedUserService);
```

This isn't a requirement because, again, _Potami doesn't care_. This is simply given as friendly advice. If you already have a way to use Service classes/functions that you like, you're free to do it that way.

#### Testing Middleware

Middleware are just functions that receive everything they need to do their job. Because of these attributes of middleware, just like testing a controller's `RequestHandler`s, you have full control over what you give the middleware to test how it behaves in a variety of scenarios.

And that's it! You should find that testing an app using Potami should be a breeze. The structures Potami provides are testable by default. If you establish any additional structures, it's up to you make them testable if that's something you prioritize.