# 0.3.0

- Updates to support context rework:
  - `makeRequestHandlerSubjects`:
    - No longer accepts nor returns a `ctx` object.
    - Now accepts a `getContext` function as property of its argument.
      - If not provided, `getContext` defaults to a function that always gives the provided context's default value.
  - `makeMiddlewareSubjects`:
    - No longer accepts nor returns a `ctx` object.
    - Now accepts `getContext` and `setContext` functions as properties of its arguments.
      - If not provided, `getContext` defaults to a function that will retrieve the value set to the provided context within the scope of this one middleware.
      - If not provided, `setContext` defaults to a function that will set the value of the context to the provided value within the scope of this one middleware.

# 0.2.0

- Added `makeRequestHandlerSubjects`.

# 0.1.0

- Released package.
