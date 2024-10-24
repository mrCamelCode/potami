export interface IRateLimiter {
  /**
   * Ingests the provided request, analyzing whether the request
   * is allowed through the limiter.
   * 
   * @param req - The incoming request.
   * @param remoteAddr - The address of the connecting client.
   * 
   * @returns Whether the limiter allows this request. If this
   * returns `false`, you should abandon or perhaps delay handling
   * of the request.
   */
  ingest(req: Request, remoteAddr: Deno.Addr): Promise<boolean> | boolean;
}