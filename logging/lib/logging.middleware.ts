import type { BaseRequestContext, Middleware } from '@potami/core';
import type { Logger } from './logger.ts';
import type { LoggingContext } from './logging.model.ts';

export interface AttachLoggerToContextOptions {
  logger: Logger;
}

/**
 * A simple middleware mainly for convenience. Puts the provided {@link Logger}
 * on the `ctx` for ease of access if you prefer not to use globals.
 */
export const attachLoggerToContext =
  <AppContextType extends BaseRequestContext & LoggingContext>({
    logger,
  }: AttachLoggerToContextOptions): Middleware<AppContextType> =>
  ({ ctx }) => {
    ctx.logger = logger;
  };
