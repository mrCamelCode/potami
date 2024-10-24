import { FakeTime } from '@std/testing/time';
import { assert, assertFalse } from 'assert';
import { describe, test } from 'bdd';
import { IpRateLimiter } from '../ip-rate-limiter.impl.ts';

const req = new Request('localhost:3000');
const remoteAddr: Deno.NetAddr = { hostname: 'localhost', port: 1234, transport: 'tcp' };

describe('IpRateLimiter', () => {
  describe('ingest', () => {
    describe('returns true when...', () => {
      test(`a new request enters and maxRequestsPerWindow > 0`, () => {
        const rateLimiter = new IpRateLimiter();

        assert(rateLimiter.ingest(req, remoteAddr));
      });
      test(`a repeat IP enters, but they haven't reached their limit`, () => {
        const rateLimiter = new IpRateLimiter();

        rateLimiter.ingest(req, remoteAddr);

        assert(rateLimiter.ingest(req, remoteAddr))
      });
      test(`an IP that had reached its limit makes another request within a new time window`, () => {
        using time = new FakeTime();

        const maxRequestsPerWindow = 5;
        const timeWindowMs = 3000;

        const rateLimiter = new IpRateLimiter({ timeWindowMs, maxRequestsPerWindow });

        for (let i = 0; i < maxRequestsPerWindow; i++) {
          assert(rateLimiter.ingest(req, remoteAddr));
        }

        assertFalse(rateLimiter.ingest(req, remoteAddr));

        time.tick(timeWindowMs);

        assert(rateLimiter.ingest(req, remoteAddr));
      });
    });
    describe('returns false when...', () => {
      test(`a new request enters and the maxRequestsPerWindow is 0`, () => {
        const rateLimiter = new IpRateLimiter({ maxRequestsPerWindow: 0 });

        assertFalse(rateLimiter.ingest(req, remoteAddr));
      });
      test(`an IP has reached the limit`, () => {
        const maxRequestsPerWindow = 5;
        const timeWindowMs = 100_000;

        const rateLimiter = new IpRateLimiter({ timeWindowMs, maxRequestsPerWindow });

        for (let i = 0; i < maxRequestsPerWindow; i++) {
          assert(rateLimiter.ingest(req, remoteAddr));
        }

        assertFalse(rateLimiter.ingest(req, remoteAddr));
      });
    });
  });
});
