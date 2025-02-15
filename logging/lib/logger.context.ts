import { Context } from '@potami/core';
import { Logger } from './logger.ts';

/**
 * Context that contains a logger instance you can use in your application.
 * If you plan to use this context, you should include the `populateLoggerContext`
 * middleware in your `entryMiddleware` before doing any logging.
 *
 * Note that use of this context is optional. If you prefer, you could make a logger
 * available to your application by creating your own instance of `Logger` that
 * your application uses. This context exists as an option for those that don't
 * like using global instances that are passed around an app through imports/exports.
 */
export const loggerContext: Context<Logger> = new Context(new Logger());
