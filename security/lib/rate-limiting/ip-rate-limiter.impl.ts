import { ArrayMap } from '../internal/data/array-map.ts';
import type { IRateLimiter } from './rate-limiter.interface.ts';

interface IpRateLimiterRegistration {
  startMs: number;
  numRequests: number;
}

export interface IpRateLimiterOptions {
  /**
   * The amount of time in MS that requests will increment for an IP
   * before resetting. When a new IP is ingested by the limiter,
   * it marks the current time. For `timeWindowMs` MS after that time,
   * that same IP may make up to `maxRequestsPerWindow` requests before the
   * limiter will say to reject them. After `timeWindowMs` MS have
   * elapsed since the IP made its first request, the limiter will
   * reset that IP's request allowance.
   *
   * A good value for this is highly dependent upon your application and
   * your use case for rate limiting.
   *
   * Defaults to `300_000` (5m).
   */
  timeWindowMs?: number;
  /**
   * The number of requests a particular IP may make within
   * `timeWindowMs` before the limiter decides to reject that
   * IP.
   *
   * Defaults to `100`.
   */
  maxRequestsPerWindow?: number;
  /**
   * Options for how the rate limiter internally cleans up its
   * registry of IPs. These options allow you to fine-tune
   * performance when you need to, as the cleanup is necessary
   * to avoid infinite registry growth but it's also not free. An IP
   * registration is eligible for cleanup if the time window
   * for limiting it has passed.
   * 
   * For servers receiving relatively low traffic (personal use,
   * prototyping, unpopular services) the defaults are likely fine.
   */
  cleanupOptions?: {
    /**
     * The maximum number of IPs that are evaluated for cleanup
     * when cleanup runs. This option exists so the cleanup process
     * doesn't have to crawl the entire registry of IPs, potentially
     * becoming a huge slowdown in systems that get a lot of traffic.
     * Batching the cleanup avoids that bottleneck.
     *
     * Choosing a good value for this will depend on your application.
     * You need to pick a value that strikes a balance between what
     * your server hardware can handle and how much traffic you get.
     * If you have a lot of traffic and a small `batchSize` (and default
     * `cleanupIntervalMs`), you may find that the cleanup doesn't clean
     * as much memory as you'd like.
     *
     * In general, larger `batchSize`s will put more strain on your
     * hardware than smaller ones.
     *
     * Defaults to `1000`.
     */
    batchSize?: number;
    /**
     * The smallest interval of time allowed between cleanup runs.
     * Because the rate limiter only cleans up as a side effect of
     * being used, the time between cleanups may be longer than this
     * time interval, but it will never be shorter.
     *
     * Choosing a good value for this depends on your application,
     * and you're generally seeking to strike a balance between what
     * your hardware can handle, how much memory you have available,
     * and how big your `batchSize` is.
     *
     * Cleaning up too often may cause general slowness, but waiting too long
     * to cleanup may make the system especially slow when the cleanup
     * does finally run, as the performance of the cleanup is tied
     * to how many IPs are registered.
     *
     * Defaults to `timeWindowMs`.
     */
    cleanupIntervalMs?: number;
  };
}

type IpRegistry = ArrayMap<IpRateLimiterRegistration>;

/**
 * A rate limiter implementation that identifies and limits clients
 * by their IP address. This limiter will ONLY limit traffic coming
 * in over TCP.
 *
 * This limiter operates in fixed time windows. That is, when a request
 * is ingested, the incoming IP is registered and the time of entry is
 * marked. For a configurable window of time, any requests the IP address
 * makes that are ingested by this limiter will count against its limit.
 * Once it reaches its limit, the rate limiter will inform the calling
 * code that the client has reached their request limit.
 *
 * This limiter tracks IPs and their limits in memory.
 */
export class IpRateLimiter implements IRateLimiter {
  #options: Required<IpRateLimiterOptions>;
  #ipRegistry: IpRegistry = new ArrayMap<IpRateLimiterRegistration>();

  #ipRegistryCleaner: RollingIpRegistryCleaner;
  #timeOfLastCleanup = Date.now();

  constructor(options: IpRateLimiterOptions = {}) {
    const timeWindowMs = options.timeWindowMs ?? 300_000;

    this.#options = {
      maxRequestsPerWindow: 100,
      ...options,
      timeWindowMs,
      cleanupOptions: {
        batchSize: 1000,
        cleanupIntervalMs: timeWindowMs,
        ...options.cleanupOptions,
      },
    };

    this.#ipRegistryCleaner = new RollingIpRegistryCleaner(
      this.#ipRegistry,
      this.#options.cleanupOptions.batchSize!,
      timeWindowMs
    );
  }

  ingest(_req: Request, remoteAddr: Deno.Addr): boolean {
    if (remoteAddr.transport === 'tcp') {
      if (this.#isTimeForCleanup()) {
        this.#ipRegistryCleaner.cleanup();

        this.#timeOfLastCleanup = Date.now();
      }

      const ip = remoteAddr.hostname;

      if (this.#isIpAtLimit(ip)) {
        if (this.#isIpWindowStale(ip)) {
          this.#resetRateLimitingDetails(ip);
          this.#registerHitForIp(ip);

          return true;
        }

        // IP is at its limit and not eligible for refresh.
        return false;
      } else {
        this.#registerHitForIp(ip);

        return true;
      }
    }

    return true;
  }

  #isIpAtLimit(ip: string): boolean {
    const numRequests = this.#ipRegistry.get(ip)?.numRequests ?? 0;

    return numRequests >= this.#options.maxRequestsPerWindow;
  }

  #isIpWindowStale(ip: string): boolean {
    const details = this.#ipRegistry.get(ip);

    if (details) {
      return Date.now() >= details.startMs + this.#options.timeWindowMs;
    }

    return false;
  }

  #registerHitForIp(ip: string): void {
    const details = this.#ipRegistry.get(ip);

    this.#ipRegistry.set(
      ip,
      details ? { ...details, numRequests: details.numRequests + 1 } : { startMs: Date.now(), numRequests: 1 }
    );
  }

  #resetRateLimitingDetails(ip: string): void {
    if (this.#ipRegistry.has(ip)) {
      this.#ipRegistry.set(ip, {
        startMs: Date.now(),
        numRequests: 0,
      });
    }
  }

  #isTimeForCleanup(): boolean {
    return Date.now() >= this.#timeOfLastCleanup + this.#options.cleanupOptions.cleanupIntervalMs!;
  }
}

/**
 * Manages cleaning a particular IpRegistry instance. This cleaner
 * performs a rolling clean. That is, it doesn't attempt to iterate
 * through the entire registry on every call to clean.
 */
class RollingIpRegistryCleaner {
  #ipRegistry: IpRegistry;
  #batchSize: number;
  #start: number;
  #timeWindowMs: number;

  get #end(): number {
    return Math.min(this.#start + this.#batchSize, this.#ipRegistry.length);
  }

  constructor(ipRegistry: IpRegistry, batchSize: number, timeWindowMs: number) {
    this.#ipRegistry = ipRegistry;
    this.#batchSize = batchSize;
    this.#timeWindowMs = timeWindowMs;
    this.#start = 0;
  }
  /**
   * Cleans up the next batch of entries in the IP registry. Will attempt
   * to pick up where it left off on the last call to `cleanup`. If the
   * registry has changed such that the last place it left off is outside
   * the bounds of the registry, the cleaner starts back at the beginning
   * of the registry.
   */
  cleanup(): void {
    if (this.#start >= this.#ipRegistry.length) {
      this.#start = 0;
    }

    const end = this.#end;

    const ipsToRemove: string[] = [];
    for (let i = this.#start; i < end; i++) {
      const registration = this.#ipRegistry.at(i);

      if (registration && this.#shouldRegistrationBeRemoved(registration)) {
        ipsToRemove.push(this.#ipRegistry.keyAt(i)!);
      }
    }

    this.#ipRegistry.remove(...ipsToRemove);

    this.#start = end - ipsToRemove.length;
  }

  #shouldRegistrationBeRemoved(registration: IpRateLimiterRegistration): boolean {
    return Date.now() >= registration.startMs + this.#timeWindowMs;
  }
}
