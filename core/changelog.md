# 0.7.0

## Breaking Changes

- The type `ServerErrorHandler` has been renamed to `ServerErrorListener`.
- The type `DefaultResponseHandler` has been renamed to `DefaultResponseListener`.
- The type `BeforeRespondHandler` has been renamed to `BeforeRespondListener`.
- The `onDefault` event has been renamed to `onDefaultResponse`.
- The `remoteAddr` given to middleware and `RequestHandler`s is now of type `Deno.NetAddr` instead of `Deno.Addr`.
- Creating a server has been tweaked
  - Instead of invoking `new HttpServer()` and calling chaining building methods on it (`base`, `controller`, etc.), that building logic has been moved to a dedicated builder to clean up and separate the `HttpServer`'s methods from its building methods. The required change is small and looks like this:
      ```ts
      // <0.7.0
      new HttpServer()
        .base(...)
        .entryMiddlware(...)
        .controller(...)
        .start(3000);

      // 0.7.0
      new HttpServer.Builder() // Now creating an instance of `HttpServer.Builder`
        .base(...)
        .entryMiddlware(...)
        .controller(...)
        .build() // `build`ing returns the underlying server the builder has been making.
        .start(3000);
      ```
  The new `HttpServer.Builder` has had all the server-building methods moved to it, so your bootstrapping code should only have to change very slightly. 
    - Additionally, **3 new building methods** have been added: `errorListeners`, `defaultResponseListeners`, and `beforeRespondListeners`. These methods will subscribe listeners to the server's `onError`, `onDefaultResponse`, and `onBeforeRespond` events, respectively.
      - You may still interact directly with the server's exposed instances of these events if you prefer.
  - For your convenience, if you need to annotate the type of an `HttpServer.Builder` instance, there is now an `HttpServerBuilder` type exported from the lib.

- Context has been reworked
  - The previous implementation created a type nightmare and having a highly-volatile super object that served as a dumping ground for any and all app information associated to a request irked me. It also added boilerplate code to guarantee strict typing that was cumbersome, and ensuring this magical super object was correctly typed was annoying at best.
  - `Middleware` and `RequestHandler` have been updated.
    - `Middleware` now receives two new functions: `getContext` and `setContext`.
    - `RequestHandler` now receives one new function: `getContext`
  - To update your application:
    - You can remove any custom context types, and the structures that used to accept a generic argument for the sake of context no longer take a generic argument.
      - You may now yeet any custom type you had for passing to these generic arguments.
    - Instead of setting context by setting a propery on `ctx`, you now create a context with `new Context`. You'll use that instance for all the new operations with context, including setting it. Use the `setContext` function now available to middleware with your `Context` instance to set the value in that scope.
    - Instead of reading properties off `ctx`, you now use `getContext` in conjunction with a `Context` instance. You'll receive the value for the current scope.
  - **For more information on what context is, what problem it solves, and how to use it, refer to the new `Context` section in the README.**

# 0.6.0

## New Features

- Added the `HtmlResponse` class.

# 0.5.0

## Breaking Changes

- The `handleCors` middleware was moved to the `@potami/security` module.
- The `handleOptions` middleware was moved to the `@potami/general` module.

## New Features

- `RequestHandler`s and `MiddlewareSubject`s now also receive a `remoteAddr` property of type `Deno.Addr`. This is useful for identifying the connection information of the client, like their IP address for example.

# 0.4.2

- Tweak documentation on context.

# 0.4.1

- Updates to documentation.

# 0.4.0

## Breaking Changes

- To ease future extension, the `RequestHandler` type has been updated.
  - `RequestHandler` functions now have a different signature. Instead of receiving the request and route params as two arguments, `RequestHandler`s now receive a single argument that is an object.
    - This object currently contains the properties:
      - `req`: The `Request` object that was being passed before as the first argument.
      - `params`: The `Record<string, string>` object that was being passed before as the second argument.
      - `ctx`: A new request context object, useful for storing information relevant to a request as it flows through the server. See **New Features** for more information.
    - Since the argument is now an object, we can more freely enhance what's provided to a request handler in the future without imposing breaking changes on your existing controllers.
- The `Immutable` class is no longer available.
  - The method by which objects were made immutable is mutually exclusive with JS private members and therefore not a fantastic way to enforce immutability.
- The addition of `ctx` has added a new required property to the `MiddlewareSubjects` type. If you have any middleware tests, those will need to be updated to pass something for `ctx`.

## New Features

- `HttpServer` now supports starting up an HTTPS server.
  - Set the server to handle traffic over SSL by using the new `ssl` chaining method.
- Middleware and `RequestHandler`s now receive a `ctx` object.
  - The `ctx` object represents request context and is a useful place to put app-specific information that's relevant for the lifetime of a request.
    - Examples of such information could be:
      - User information learned from processing authorization present on the request.
      - Session information.
      - Any of your own information relevant to your app's needs.
  - It's planned that first-party Potami modules will make use of `ctx` to handle common server use cases for you while still exposing the information relevant to you as you process a request.
  - `ctx` is strongly-typed.
    - The `HttpServer`, `Controller`, `Middleware`, `MiddlewareChain`, and `RequestHandler` types have all been updated to include an OPTIONAL generic type argument which allows you to specify the shape of the request context they'll receive.
    - See the documentation for the new `Contextual` type for more information.

## Misc. Changes

- Items that previously had runtime-enforced immutability (like the server instance passed to middleware) no longer have runtime-enforced immutability.
  - This happened because we swapped to using proper JS private member syntax instead of the `private` keyword. The way we were enforcing immutability is mutually exclusive with JS private members.
  - This doesn't affect your existing code, as no existing code at this point should've been mutating immutable items (your app would've crashed if you were).
  - This doesn't mean these are now mutable, but their immutability is now something enfored at compile-time, and/or it's mentioned in the docs on the item that you shouldn't be mutating it.

# 0.3.8

- Internal updates, no breaking changes.

# 0.3.7

- Adjust namespace.

# 0.3.6

- Internal updates.
- Published to JSR.

# 0.3.5

- Internal updates.

# 0.3.4

- Added `HttpServer.abort` method for more abrupt server stopping.
