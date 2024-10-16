# @potami/logging

This is a module intended to supplement applications built with [Potami](https://jsr.io/@potami/core).

This module provides logging utilities, namely the `Logger` class.

Using and creating a logger is simple with this module!

1. Create your logger:
    ```ts
    import { Logger, LogLevel } from '@potami/logging';

    // With defaults
    const logger = new Logger();

    // Customized
    const customizedLogger = new Logger(LogLevel.Debug, {
      logLevelToColor: {
        ...Logger.DEFAULT_OPTIONS.logLevelToColor,
        info: 'blue',
      }
    });
    ```
2. Use your logger instance
    ```ts
    logger.debug('Beepin the boop.');
    logger.info('Beep has been booped.');
    logger.warn('Beep struggled to boop.');
    logger.error('Beep could not boop.');
    ```
3. Enjoy beautiful, timestamped, formatted, color-coded logs in your standard output 💆

    