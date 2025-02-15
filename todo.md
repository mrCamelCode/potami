- Allow a path matcher regex to be specified for middleware so that middleware can be restricted to only running for certain paths more easily.
  - Useful for more generic paths, i.e. "Only run my auth middleware on paths that match `/\/secured/`"
- Allow request handler middleware
  - Would be useful for middleware that runs only on a very specific route/handler. This would have one obvious use of role-based auth route guards.
  - The type of `RequestHandler` could be updated to expect EITHER:
    1. The funvtion signature it currently expects
    1. An array, where the first element is an array of middleware and the second argument is the function signature it currently expects.
