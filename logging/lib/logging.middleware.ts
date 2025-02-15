import type { Middleware } from '@potami/core';
import { loggerContext } from './logger.context.ts';
import type { Logger } from './logger.ts';

export interface AttachLoggerToContextOptions {
  logger: Logger;
}

/**
 * A simple middleware mainly for convenience. Puts the provided {@link Logger}
 * on the {@link loggerContext} for retrieval. 
 * 
 * Using this middleware isn't required to use a logger. This method simply 
 * exists for those that want to retrieve their logger from context instead of 
 * importing/exporting an instance.
 */
export const populateLoggerContext =
  ({ logger }: AttachLoggerToContextOptions): Middleware =>
  ({ setContext }) => {
    setContext(loggerContext, logger);
  };
