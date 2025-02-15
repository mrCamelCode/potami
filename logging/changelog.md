# 0.3.0

## Breaking Changes

- Updates to support reworked context:
  - Removed the `LoggingContext` type
  - Added the `loggerContext` `Context` instance.
  - Changed `attachLoggerToContext` to `populateLoggerContext`.
- The color for `info` logs was changed to the default color for the environment. In most cases, this will be the color you'd expect regular text to be based on your current environment.
# 0.2.0

- Added the `attachLoggerToContext` middleware and the accompanying `LoggingContext` utility type.

# 0.1.0

- Released package, including `Logger` class.