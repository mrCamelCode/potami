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

  'GET /': RequestHandler = ({ req }) => {
    return new Response('Hello world!', { status: 200 });
  };
}

const server = new HttpServer();

server.base('/api').controller(new HelloController()).start(3000);
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

  'GET /': RequestHandler = ({ req }) => {
    return new Response('Hello, world!', { status: 200 });
  };

  'GET /json': RequestHandler = ({ req }) => {
    return new JsonResponse({ value: 'Hello, world!' }, { status: 200 });
  };

  'GET /greet/:name': RequestHandler = ({ req, params: { name } }) => {
    return new Response(`Hello, ${name}!`, { status: 200 });
  };

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

and there's **Controller Middleware** you can apply at the controller level:

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
server.entryMiddleware(checkAuth, rateLimit, talkToDb, attachAppHeaders);
```

where `talkToDb` is asynchronous, Potami will wait for `talkToDb` to finish before invoking `attachAppHeaders`. This improves predictability and consistency. It also allows you to put the _most_ important things first.

In this case, we `checkAuth` before doing anything else. That middleware may throw a `ForbiddenError` or an `UnauthenticatedError` in the event there's something wrong with the `Authorization` on the request. Because Potami guarantees order, you can be confident that a request won't flow through the rest of your server if it can't pass your important validation middleware.

### Context

#### What Is Context?

Oftentimes in an HTTP server, an application has app-specific information that it would like to associate to an individual request when it comes in. This could be information about the authorization present on the request, information about the IP address the request came from, information about the requester's session, etc. Since Potami provides generic mechanisms with which to build an HTTP server, it can't know what data your specific application will need. Context exists as a way for you to make request-specific information available to any stage of processing a request as it goes from ingestion to eventually yielding a response.

#### When to Use Context

**You might never need context**. It's very possible to write a server app that simply doesn't need it. But, if you find yourself needing to track some information about a request so you can access that information in different parts of your request processing, you probably want context. What's more, you don't have to track that kind of information with context. If you have your own mechanism for solving that problem, you're free to use it. Context isn't magic; it's simply a ready-made mechanism that Potami offers as a solution if you need/want it.

For an example of when you need something like context, consider a common feature like sessioning and assume that the sessioning implementation uses cookies to track user sessions. When a request comes into your server, it should be bearing a cookie that designates its session in your server's session store.

If the cookie is missing, this tells the server it needs to make a new session. We might handle that in entry middleware. Our session objects might track something like the current user's name, whether they're authenticated, and how many login attempts they've made.

Once we've guaranteed that a session is tied to that user's session cookie, the information we store on it can be useful throughout the application.

We may have entry middleware after the aforementioned one that checks the session to make sure the user hasn't exceeded the application's maximum number of logins. If they have, we may choose to reject their request outright and abandon further processing.

If their request is handled by a controller that requires an authenticated user, we might write a controller middleware to check that the session is authenticated. If it isn't, we may once again choose to reject the request.

If they've logged in successfully, the name on the session would be populated. We may use that name in a `RequestHandler` in a controller to give them a personalized greeting on a page.

The session data has an important characteristic that makes it a good candidate for context: **the information is derived from information on the request and it's useful at any stage of request processing**.

#### How Context Works

At a high level, context is simply app-specific information that's associated with a specific request. When a request enters the server, Potami creates a place to store context values and associates it with that request. Your application code may create `Context` objects, which you'll use to define a default value for that context. You'll also use that instance to get/set that context's value in the relevant scope.

Both entry and controller middleware may set and get context at any point. A `RequestHandler` in a controller may only get context at any point. `RequestHandler`s aren't provided a function to set context because they're the end of the line for request processing. There's no other stage of request processing that would access context they've set, so setting context at that stage would be pointless.

The value you get when you get context depends on the scope you're currently in. You can think of there being two scopes: global and controller. The "global" scope is global in the sense that it's global to the request, not to the application. You cannot access a request's context information from another request.

If you get/set context in entry middleware, the scope is "global". If no global value was set previously for the request, the context's default value is given when getting that context.

If you get/set context in a controller's middleware, the scope is "controller". If you get context in a `RequestHandler` or a controller's middleware, you'll get that context's controller-scoped value. If no controller-scoped value was set in that controller's middleware, Potami looks to the value for the global scope. If a value exists, it's given. If it doesn't, the context's default value is given.

Finally, if you set context twice in the same scope, the second set overwrites the first.

That's a lot of words. Let's see some code!

#### How to Use Context

Using context is easy! The overview is:

1. Create a context instance with a default value: 
    ```ts
    import { Context } from '@potami/core';

    const myContext = new Context(0);
    ```
2. Call `setContext` to give that context a value:
    ```ts
    import { type Middleware } from '@potami/core';

    const myEntryMiddleware: Middleware = ({ setContext }) => setContext(myContext, 123);
    ```
3. Call `getContext` after you've set it to get the value you set it to:
    ```ts
    import { type Middleware, ServerError } from '@potami/core';

    const myControllerMiddleware: Middleware = ({ getContext }) => {
      if (getContext(myContext) === 123) {
        throw new ServerError('Boom!')
      }
    }
    ```

#### Context Code Reference

Here's a code reference that covers many of the scenarios of context usage.

```ts
import { Context, Controller, RequestHandler, JsonResponse } from '@potami/core';

// The default value is an empty string.
const ipContext = new Context('');

// Assuming a `server` exists that's an instance of `HttpServer`:
server
  .entryMiddleware(
    ({ getContext }) => {
      // Will print an empty string at this point, because we haven't set it yet. Therefore, the default value is given.
      console.log(getContext(ipContext));
    },
    // Associate the user's IP address to the request.
    ({ remoteAddr, setContext }) => {
      setContext(ipContext, remoteAddr.hostname);
    },
    ({ getContext }) => {
      // Will print the requester's IP address at this point, because the context was set in the previous middleware.
      console.log(getContext(ipContext));
    }
  )
  .controller(new MyController());

// The value for context can be anything! The Context class is also generic, so you can describe the exact type of your context if needed.
const controllerContext = new Context<{ sayHello: boolean; username: string; randomNumber: number }>({
  sayHello: false,
  username: '',
  randomNumber: 0,
});

class MyController extends Controller {
  constructor() {
    super({
      base: '/my',
      middleware: [
        ({ getContext }) => {
          // Will print the requester's IP address. `getContext` will first look at the controller's scope for a controller-specific value for this context. None has been set, so Potami then looks for a global value for this context. We set the value in that scope in one of our entry middleware above to `remoteAddr.hostname`, which would be the requester's IP.
          console.log(getContext(ipContext));
        },
        ({ setContext }) => {
          // This sets this context's value in this controller's scope. If any following middleware or a `RequestHandler` gets this context, it will now get this value instead of the result of `remoteAddr.hostname`.
          setContext(ipContext, '123.123.123');
        },
        ({ getContext }) => {
          // Will print '123.123.123'
          console.log(getContext(ipContext));
        },
        ({ setContext }) => {
          // Context doesn't need to have been set globally to be able to set it at the controller level. Any following middleware in this controller or a `RequestHandler` will now get this value if it gets `controllerContext`.
          setContext(controllerContext, { sayHello: false, username: 'Potami', randomNumber: 123 });
        },
      ],
    });
  }

  'GET /': RequestHandler = ({ getContext }) => {
    // Would be '123.123.123'.
    const ip = getContext(ipContext);

    // Will print { sayHello: false, username: 'Potami', randomNumber: 123 }
    console.log(getContext(controllerContext));

    new JsonResponse({
      message: `Your IP address is: ${ip}`,
    });
  };
}
```

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
  #userService: UserService;

  constructor(userService: UserService) {
    super({ base: '/users' });

    this.#userService = userService;
  }

  'GET /:userId': RequestHandler = ({req, params: { userId }}) => {
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
