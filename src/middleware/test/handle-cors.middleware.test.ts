import { assert, assertEquals, assertFalse } from 'assert';
import { describe, test } from 'bdd';
import { HttpServer } from '../../http-server.ts';
import { HttpMethod } from '../../model.ts';
import { handleCors } from '../handle-cors.middleware.ts';

const BASE_URL = 'http://localhost:3000';
const mockServer = new HttpServer();
const mockPreflightRequest = new Request(BASE_URL, { method: HttpMethod.Options });
const mockPreflightRequestWithOrigin = new Request(BASE_URL, {
  method: HttpMethod.Options,
  headers: {
    Origin: 'http://unluckycricketgames.com',
  },
});

const mockRequest = new Request(BASE_URL, { method: HttpMethod.Get });
const mockRequestWithOrigin = new Request(BASE_URL, {
  method: HttpMethod.Get,
  headers: {
    Origin: 'http://unluckycricketgames.com',
  },
});

describe('handleCors', () => {
  describe('preflight request', () => {
    describe(`respondOnPreflight`, () => {
      test(`when false, doesn't send a response`, async () => {
        const response = await handleCors({ respondOnPreflight: false })({
          req: mockPreflightRequest,
          server: mockServer,
          resHeaders: new Headers(),
        });

        assertEquals(response, undefined);
      });
      test(`when true, sends a response`, async () => {
        const response = await handleCors({ respondOnPreflight: true })({
          req: mockPreflightRequest,
          server: mockServer,
          resHeaders: new Headers(),
        });

        assert(!!response);
        assertEquals(response?.status, 200);
      });
      test(`when true, sends a response that respects the passed optionsSuccessStatus`, async () => {
        const response = await handleCors({ respondOnPreflight: true, optionsSuccessStatus: 204 })({
          req: mockPreflightRequest,
          server: mockServer,
          resHeaders: new Headers(),
        });

        assert(!!response);
        assertEquals(response?.status, 204);
      });
    });
    describe('maxAge', () => {
      test(`respects defined maxAge`, async () => {
        const headers = new Headers();

        await handleCors({ maxAge: 200 })({
          req: mockPreflightRequest,
          resHeaders: headers,
          server: mockServer,
        });

        assertEquals(headers.get('access-control-max-age'), '200');
      });
      test(`respects maxAge of 0`, async () => {
        const headers = new Headers();

        await handleCors({ maxAge: 0 })({
          req: mockPreflightRequest,
          resHeaders: headers,
          server: mockServer,
        });

        assertEquals(headers.get('access-control-max-age'), '0');
      });
      test(`has no max age when it's not defined`, async () => {
        const headers = new Headers();

        await handleCors()({
          req: mockPreflightRequest,
          resHeaders: headers,
          server: mockServer,
        });

        assertEquals(headers.get('access-control-max-age'), null);
      });
    });
    describe('exposedHeaders', () => {
      test(`provided exposedHeaders are present`, async () => {
        const headers = new Headers();

        await handleCors({ exposedHeaders: ['Content-Range', 'X-Content-Range'] })({
          req: mockPreflightRequest,
          resHeaders: headers,
          server: mockServer,
        });

        assertEquals(headers.get('access-control-expose-headers'), 'Content-Range,X-Content-Range');
      });
      test(`no exposed headers are present when not provided`, async () => {
        const headers = new Headers();

        await handleCors()({
          req: mockPreflightRequest,
          resHeaders: headers,
          server: mockServer,
        });

        assertEquals(headers.get('access-control-expose-headers'), null);
      });
    });
    describe('allowedHeaders', () => {
      describe('Access-Control-Allow-Headers header', () => {
        test(`included when allowedHeaders is specified`, async () => {
          const headers = new Headers();

          await handleCors({ allowedHeaders: ['Content-Type', 'Authorization'] })({
            req: mockPreflightRequest,
            resHeaders: headers,
            server: mockServer,
          });

          const header = headers.get('Access-Control-Allow-Headers');

          assertEquals(header, 'Content-Type,Authorization');
        });
        test(`reflects the request's header when allowedHeaders isn't defined`, async () => {
          const headers = new Headers();

          await handleCors()({
            req: new Request(BASE_URL, {
              method: HttpMethod.Options,
              headers: {
                'Access-Control-Allow-Headers': 'Content-Type',
              },
            }),
            resHeaders: headers,
            server: mockServer,
          });

          const header = headers.get('Access-Control-Allow-Headers');

          assertEquals(header, 'Content-Type');
        });
        test(`absent if allowedHeaders isn't defined and it's absent on the request`, async () => {
          const headers = new Headers();

          await handleCors()({
            req: mockPreflightRequest,
            resHeaders: headers,
            server: mockServer,
          });

          const header = headers.get('Access-Control-Allow-Headers');

          assertEquals(header, null);
        });
      });
      describe('Vary header', () => {
        test(`Vary header is set when the request header is reflected`, async () => {
          const headers = new Headers();

          await handleCors()({
            req: new Request(BASE_URL, {
              method: HttpMethod.Options,
              headers: {
                'Access-Control-Allow-Headers': 'Content-Type',
              },
            }),
            resHeaders: headers,
            server: mockServer,
          });

          const header = headers.get('Vary');

          assert(header?.includes('Access-Control-Request-Headers'));
        });
        test(`Vary header is set when the request header is reflected, but the request has no such header`, async () => {
          const headers = new Headers();

          await handleCors()({
            req: mockPreflightRequest,
            resHeaders: headers,
            server: mockServer,
          });

          const header = headers.get('Vary');

          assert(header?.includes('Access-Control-Request-Headers'));
        });
        test(`Vary header is absent when allowedHeaders is defined`, async () => {
          const headers = new Headers();

          await handleCors({ allowedHeaders: ['Content-Type', 'Authorization'] })({
            req: mockPreflightRequest,
            resHeaders: headers,
            server: mockServer,
          });

          const header = headers.get('Vary');

          assertFalse(header?.includes('Access-Control-Request-Headers'));
        });
      });
    });
    describe('includeCredentialsHeader', () => {
      test(`includes the header when true`, async () => {
        const headers = new Headers();

        await handleCors({ includeCredentialsHeader: true })({
          req: mockPreflightRequest,
          server: mockServer,
          resHeaders: headers,
        });

        assertEquals(headers.get('Access-Control-Allow-Credentials'), 'true');
      });
      test(`doesn't include the header when false`, async () => {
        const headers = new Headers();

        await handleCors({ includeCredentialsHeader: false })({
          req: mockPreflightRequest,
          server: mockServer,
          resHeaders: headers,
        });

        assertEquals(headers.get('Access-Control-Allow-Credentials'), null);
      });
    });
    describe('methods', () => {
      test(`the methods are included in the headers when provided`, async () => {
        const headers = new Headers();

        await handleCors({ methods: [HttpMethod.Get, HttpMethod.Post] })({
          req: mockPreflightRequest,
          server: mockServer,
          resHeaders: headers,
        });

        assertEquals(headers.get('Access-Control-Allow-Methods'), 'GET,POST');
      });
      test(`the header is empty when methods has no items`, async () => {
        const headers = new Headers();

        await handleCors({ methods: [] })({
          req: mockPreflightRequest,
          server: mockServer,
          resHeaders: headers,
        });

        assertEquals(headers.get('Access-Control-Allow-Methods'), '');
      });
    });
    describe('origin', () => {
      const headerName = 'access-control-allow-origin';

      describe('any origin (blank or *)', () => {
        test(`is any origin when blank`, async () => {
          const headers = new Headers();

          await handleCors({ origin: '' })({
            req: mockPreflightRequest,
            server: mockServer,
            resHeaders: headers,
          });

          assertEquals(headers.get(headerName), '*');
        });
        test(`is any origin when the origin is *`, async () => {
          const headers = new Headers();

          await handleCors({ origin: '*' })({
            req: mockPreflightRequest,
            server: mockServer,
            resHeaders: headers,
          });

          assertEquals(headers.get(headerName), '*');
        });
        test(`Vary header is NOT set when the origin is *`, async () => {
          const headers = new Headers();

          await handleCors({ origin: '*' })({
            req: mockPreflightRequest,
            server: mockServer,
            resHeaders: headers,
          });

          assertFalse(headers.get('Vary')?.includes('*'));
        });
      });
      describe('fixed origin (string)', () => {
        test(`fixed origin is included`, async () => {
          const headers = new Headers();

          await handleCors({ origin: 'http://unluckycricketgames.com' })({
            req: mockPreflightRequestWithOrigin,
            server: mockServer,
            resHeaders: headers,
          });

          assertEquals(headers.get(headerName), 'http://unluckycricketgames.com');
        });
        test(`Vary header is present with a fixed origin`, async () => {
          const headers = new Headers();

          await handleCors({ origin: 'http://unluckycricketgames.com' })({
            req: mockPreflightRequestWithOrigin,
            server: mockServer,
            resHeaders: headers,
          });

          assert(headers.get('Vary')?.includes('Origin'));
        });
      });
      describe('match origin (RegExp or (string | RegExp)[])', () => {
        describe('RegExp', () => {
          test(`request origin is present if it matched the regex`, async () => {
            const headers = new Headers();

            await handleCors({ origin: /unlucky/ })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), mockPreflightRequestWithOrigin.headers.get('origin'));
          });
          test(`header is absent if the request's origin doesn't match the regex`, async () => {
            const headers = new Headers();

            await handleCors({ origin: /nope/ })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), null);
          });
          test(`Vary contains Origin if the request origin matched`, async () => {
            const headers = new Headers();

            await handleCors({ origin: /unlucky/ })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
          test(`Vary contains Origin if the request origin didn't match`, async () => {
            const headers = new Headers();

            await handleCors({ origin: /nope/ })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
        });
        describe('string[]', () => {
          test(`request origin is present if it equalled any string in the array`, async () => {
            const headers = new Headers();

            await handleCors({ origin: ['http://unluckycricketgames.com', 'https://some.other.domain.google.com'] })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), mockPreflightRequestWithOrigin.headers.get('origin'));
          });
          test(`header is absent if the request's origin isn't in the string array`, async () => {
            const headers = new Headers();

            await handleCors({
              origin: ['http://not.unluckycricketgames.com', 'https://some.other.domain.google.com'],
            })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), null);
          });
          test(`Vary contains Origin if the request origin was in the array`, async () => {
            const headers = new Headers();

            await handleCors({ origin: ['http://unluckycricketgames.com', 'https://some.other.domain.google.com'] })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
          test(`Vary contains Origin if the request origin wasn't in the array`, async () => {
            const headers = new Headers();

            await handleCors({
              origin: ['http://not.unluckycricketgames.com', 'https://some.other.domain.google.com'],
            })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
        });
        describe('RegExp[]', () => {
          test(`request origin is present if it matched any regex in the array`, async () => {
            const headers = new Headers();

            await handleCors({ origin: [/something/, /unlucky/] })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), mockPreflightRequestWithOrigin.headers.get('origin'));
          });
          test(`header is absent if the request's origin didn't match a regex in the array`, async () => {
            const headers = new Headers();

            await handleCors({
              origin: [/something/, /unluckys/],
            })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), null);
          });
          test(`Vary contains Origin if the request origin matched a regex in the array`, async () => {
            const headers = new Headers();

            await handleCors({ origin: [/something/, /unlucky/] })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
          test(`Vary contains Origin if the request origin didn't match a regex in the array`, async () => {
            const headers = new Headers();

            await handleCors({
              origin: [/something/, /unluckys/],
            })({
              req: mockPreflightRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
        });
      });
    });
  });

  describe('regular request', () => {
    describe('origin', () => {
      const headerName = 'access-control-allow-origin';

      describe('any origin (blank or *)', () => {
        test(`is any origin when blank`, async () => {
          const headers = new Headers();

          await handleCors({ origin: '' })({
            req: mockRequest,
            server: mockServer,
            resHeaders: headers,
          });

          assertEquals(headers.get(headerName), '*');
        });
        test(`is any origin when the origin is *`, async () => {
          const headers = new Headers();

          await handleCors({ origin: '*' })({
            req: mockRequest,
            server: mockServer,
            resHeaders: headers,
          });

          assertEquals(headers.get(headerName), '*');
        });
        test(`Vary header is NOT set when the origin is *`, async () => {
          const headers = new Headers();

          await handleCors({ origin: '*' })({
            req: mockRequest,
            server: mockServer,
            resHeaders: headers,
          });

          assertFalse(headers.get('Vary')?.includes('*'));
        });
      });
      describe('fixed origin (string)', () => {
        test(`fixed origin is included`, async () => {
          const headers = new Headers();

          await handleCors({ origin: 'http://unluckycricketgames.com' })({
            req: mockRequestWithOrigin,
            server: mockServer,
            resHeaders: headers,
          });

          assertEquals(headers.get(headerName), 'http://unluckycricketgames.com');
        });
        test(`Vary header is present with a fixed origin`, async () => {
          const headers = new Headers();

          await handleCors({ origin: 'http://unluckycricketgames.com' })({
            req: mockRequestWithOrigin,
            server: mockServer,
            resHeaders: headers,
          });

          assert(headers.get('Vary')?.includes('Origin'));
        });
      });
      describe('match origin (RegExp or (string | RegExp)[])', () => {
        describe('RegExp', () => {
          test(`request origin is present if it matched the regex`, async () => {
            const headers = new Headers();

            await handleCors({ origin: /unlucky/ })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), mockRequestWithOrigin.headers.get('origin'));
          });
          test(`header is absent if the request's origin doesn't match the regex`, async () => {
            const headers = new Headers();

            await handleCors({ origin: /nope/ })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), null);
          });
          test(`Vary contains Origin if the request origin matched`, async () => {
            const headers = new Headers();

            await handleCors({ origin: /unlucky/ })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
          test(`Vary contains Origin if the request origin didn't match`, async () => {
            const headers = new Headers();

            await handleCors({ origin: /nope/ })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
        });
        describe('string[]', () => {
          test(`request origin is present if it equalled any string in the array`, async () => {
            const headers = new Headers();

            await handleCors({ origin: ['http://unluckycricketgames.com', 'https://some.other.domain.google.com'] })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), mockRequestWithOrigin.headers.get('origin'));
          });
          test(`header is absent if the request's origin isn't in the string array`, async () => {
            const headers = new Headers();

            await handleCors({
              origin: ['http://not.unluckycricketgames.com', 'https://some.other.domain.google.com'],
            })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), null);
          });
          test(`Vary contains Origin if the request origin was in the array`, async () => {
            const headers = new Headers();

            await handleCors({ origin: ['http://unluckycricketgames.com', 'https://some.other.domain.google.com'] })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
          test(`Vary contains Origin if the request origin wasn't in the array`, async () => {
            const headers = new Headers();

            await handleCors({
              origin: ['http://not.unluckycricketgames.com', 'https://some.other.domain.google.com'],
            })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
        });
        describe('RegExp[]', () => {
          test(`request origin is present if it matched any regex in the array`, async () => {
            const headers = new Headers();

            await handleCors({ origin: [/something/, /unlucky/] })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), mockRequestWithOrigin.headers.get('origin'));
          });
          test(`header is absent if the request's origin didn't match a regex in the array`, async () => {
            const headers = new Headers();

            await handleCors({
              origin: [/something/, /unluckys/],
            })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assertEquals(headers.get(headerName), null);
          });
          test(`Vary contains Origin if the request origin matched a regex in the array`, async () => {
            const headers = new Headers();

            await handleCors({ origin: [/something/, /unlucky/] })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
          test(`Vary contains Origin if the request origin didn't match a regex in the array`, async () => {
            const headers = new Headers();

            await handleCors({
              origin: [/something/, /unluckys/],
            })({
              req: mockRequestWithOrigin,
              resHeaders: headers,
              server: mockServer,
            });

            assert(headers.get('Vary')?.includes('Origin'));
          });
        });
      });
    });
    describe('includeCredentialsHeader', () => {
      test(`includes the header when true`, async () => {
        const headers = new Headers();

        await handleCors({ includeCredentialsHeader: true })({
          req: mockRequest,
          server: mockServer,
          resHeaders: headers,
        });

        assertEquals(headers.get('Access-Control-Allow-Credentials'), 'true');
      });
      test(`doesn't include the header when false`, async () => {
        const headers = new Headers();

        await handleCors({ includeCredentialsHeader: false })({
          req: mockRequest,
          server: mockServer,
          resHeaders: headers,
        });

        assertEquals(headers.get('Access-Control-Allow-Credentials'), null);
      });
    });
    describe('exposedHeaders', () => {
      test(`provided exposedHeaders are present`, async () => {
        const headers = new Headers();

        await handleCors({ exposedHeaders: ['Content-Range', 'X-Content-Range'] })({
          req: mockRequest,
          resHeaders: headers,
          server: mockServer,
        });

        assertEquals(headers.get('access-control-expose-headers'), 'Content-Range,X-Content-Range');
      });
      test(`no exposed headers are present when not provided`, async () => {
        const headers = new Headers();

        await handleCors()({
          req: mockRequest,
          resHeaders: headers,
          server: mockServer,
        });

        assertEquals(headers.get('access-control-expose-headers'), null);
      });
    });
  });
});
