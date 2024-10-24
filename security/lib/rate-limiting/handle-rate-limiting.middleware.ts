import { type Middleware, type MiddlewareSubjects, HttpError } from '@potami/core';
import type { IRateLimiter } from './rate-limiter.interface.ts';

export interface HandleRateLimitingOptions {
  /**
   * The rate limiter implementation to use.
   */
  rateLimiter: IRateLimiter;
  /**
   * Callback for when the `rateLimiter` indicates that the incoming request
   * shouldn't be allowed through.
   *
   * Defaults to a function that throws an {@link HttpError} with status 429 (Too Many Requests).
   *
   * @param req - The request that came in.
   * @param remoteAddr - The remote address info from the connecting client.
   */
  onLimitReached?: (req: MiddlewareSubjects['req'], remoteAddr: MiddlewareSubjects['remoteAddr']) => void;
}

/**
 * Rate limits any requests that pass through. Handling when a client
 * has reached their request limit can be configured with the `onLimitReached`
 * option.
 *
 * Rate limiting can be useful for protecting against DoS/DDoS, brute force
 * attacks, and other undesirable interactions with your service that involve
 * a client making more requests to the server than is reasonable. It's
 * generally regarded as good security posture to have some degree of rate
 * limiting on a web server.
 *
 * This middleware could be used in several places on the server. For example,
 * you could use this middleware as entry middleware to apply a global
 * and lax rate limit for the server as a whole. You could then attach
 * this middleware with a different `rateLimiter` to a controller that handles
 * user login. That controller could have a much stricter limit to help
 * defend against password brute forcing.
 */
export const handleRateLimiting =
  ({
    rateLimiter,
    onLimitReached = () => {
      throw new HttpError(429);
    },
  }: HandleRateLimitingOptions): Middleware =>
  async ({ req, remoteAddr }) => {
    if (!(await rateLimiter.ingest(req, remoteAddr))) {
      onLimitReached(req, remoteAddr);
    }
  };
