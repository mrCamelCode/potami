import { HttpMethod, type Middleware } from '@potami/core';

/*
 * This middleware was greatly informed by the `cors` middleware for
 * Express. Big thanks to them!
 */

export interface HandleCorsOptions {
  /**
   * (Defaults to *) The origin that the server will allow.
   * Influences the `Access-Control-Allow-Origin` header.
   *
   * This can be:
   *
   * 1. A `string`. The allowed origin will be set to the provided
   * string.
   * 1. A `RegExp`. The allowed origin will be set to the request's
   * origin if it exists and it matches on the regex.
   * 1. An array of strings/regexes. The allowed origin will be set
   * to the request's origin if it exists and if it matches anything
   * in the array. For strings, the request's origin must match the
   * string exactly.
   */
  origin?: string | RegExp | (string | RegExp)[];
  /**
   * (Defaults to ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'])
   * Controls the `Access-Control-Allow-Methods` header.
   */
  methods?: string[];
  /**
   * Controls the `Access-Control-Allow-Headers` header. If unspecified,
   * uses the requests's `Access-Control-Request-Headers` header.
   */
  allowedHeaders?: string[];
  /**
   * Controls the `Access-Control-Expose-Headers` header. Omitted if
   * unspecified.
   */
  exposedHeaders?: string[];
  /**
   * Controls the `Access-Control-Max-Age` header. Omitted if unspecified.
   */
  maxAge?: number;
  /**
   * Controls whether the `Access-Control-Allow-Credentials` header is
   * sent.
   */
  includeCredentialsHeader?: boolean;
  /**
   * (Defaults to true) Whether the middleware will return a `Response`
   * (thereby causing the server to skip any further middleware/controller)
   * after handling a CORS preflight OPTIONS request.
   */
  respondOnPreflight?: boolean;
  /**
   * (Defaults to 200) The status to use on the returned `Response` if
   * `respondOnPreflight` is `true`.
   */
  optionsSuccessStatus?: 200 | 204;
}

/**
 * Intended to be used as Entry Middleware. This middleware manages handling
 * CORS (Cross-Origin Resource Sharing). With the default configuration, this
 * middleware will allow requests from any origin and will automatically handle
 * the [preflight OPTIONS requests](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
 * that browsers may send if a request isn't deemed "simple".
 *
 * In general, if you don't know why you'd be changing a particular option
 * from its default, it's best if you don't.
 */
export const handleCors =
  ({
    origin = '*',
    methods = [HttpMethod.Get, HttpMethod.Head, HttpMethod.Put, HttpMethod.Patch, HttpMethod.Post, HttpMethod.Delete],
    respondOnPreflight = true,
    optionsSuccessStatus = 200,
    maxAge,
    allowedHeaders,
    exposedHeaders,
    includeCredentialsHeader,
  }: HandleCorsOptions = {}): Middleware<any> =>
  ({ req, ...otherSubjects }) => {
    if (req.method === HttpMethod.Options) {
      return handlePreflight({
        origin,
        methods,
        respondOnPreflight,
        optionsSuccessStatus,
        maxAge,
        allowedHeaders,
        exposedHeaders,
        includeCredentialsHeader,
      })({ req, ...otherSubjects });
    } else {
      handleOrigin(origin)({ req, ...otherSubjects });
      handleCredentials(includeCredentialsHeader)({ req, ...otherSubjects });
      handleExposedHeaders(exposedHeaders)({ req, ...otherSubjects });
    }
  };

const handlePreflight =
  ({
    maxAge,
    exposedHeaders,
    allowedHeaders,
    respondOnPreflight,
    optionsSuccessStatus,
    includeCredentialsHeader,
    methods,
    origin,
  }: HandleCorsOptions): Middleware =>
  (middlewareSubjects) => {
    handleOrigin(origin)(middlewareSubjects);
    handleCredentials(includeCredentialsHeader)(middlewareSubjects);
    handleMethods(methods)(middlewareSubjects);
    handleAllowedHeaders(allowedHeaders)(middlewareSubjects);
    handleMaxAge(maxAge)(middlewareSubjects);
    handleExposedHeaders(exposedHeaders)(middlewareSubjects);

    if (respondOnPreflight) {
      return new Response(undefined, { status: optionsSuccessStatus });
    }
  };

const handleMaxAge =
  (maxAge: HandleCorsOptions['maxAge']): Middleware =>
  ({ resHeaders }) => {
    if (maxAge !== undefined) {
      resHeaders.set('Access-Control-Max-Age', `${maxAge}`);
    }
  };

const handleExposedHeaders =
  (exposedHeaders: HandleCorsOptions['exposedHeaders']): Middleware =>
  ({ resHeaders }) => {
    const headersString = exposedHeaders?.join(',');

    if (headersString) {
      resHeaders.set('Access-Control-Expose-Headers', headersString);
    }
  };

const handleAllowedHeaders =
  (allowedHeaders: HandleCorsOptions['allowedHeaders']): Middleware =>
  ({ req, resHeaders }) => {
    const headerName = 'Access-Control-Allow-Headers';

    if (allowedHeaders) {
      resHeaders.set(headerName, allowedHeaders.join(','));
    } else {
      // Reflect request headers, if present
      const reqHeader = req.headers.get(headerName);
      if (reqHeader !== null) {
        resHeaders.set(headerName, reqHeader);
      }

      appendToVary(resHeaders, 'Access-Control-Request-Headers');
    }
  };

const handleCredentials =
  (includeCredentialsHeader: HandleCorsOptions['includeCredentialsHeader']): Middleware =>
  ({ resHeaders }) => {
    if (includeCredentialsHeader) {
      resHeaders.set('Access-Control-Allow-Credentials', 'true');
    }
  };

const handleMethods =
  (methods: HandleCorsOptions['methods']): Middleware =>
  ({ resHeaders }) => {
    if (methods) {
      resHeaders.set('Access-Control-Allow-Methods', methods.join(','));
    }
  };

const handleOrigin =
  (origin: HandleCorsOptions['origin']): Middleware =>
  ({ req, resHeaders }) => {
    const headerName = 'Access-Control-Allow-Origin';
    const requestOrigin = req.headers.get('origin');

    if (!origin || origin === '*') {
      resHeaders.set(headerName, '*');
    } else if (typeof origin === 'string') {
      resHeaders.set(headerName, origin);

      appendToVary(resHeaders, 'Origin');
    } else if (requestOrigin) {
      if (isOriginAllowed(requestOrigin, origin)) {
        resHeaders.set(headerName, requestOrigin);
      }

      appendToVary(resHeaders, 'Origin');
    }
  };

function isOriginAllowed(requestOrigin: string, origin: RegExp | (string | RegExp)[]): boolean {
  if (Array.isArray(origin)) {
    return origin.some((o) => {
      if (typeof o === 'string') {
        return requestOrigin === o;
      } else {
        return o.test(requestOrigin);
      }
    });
  } else {
    return origin.test(requestOrigin);
  }
}

function appendToVary(headers: Headers, value: string) {
  if (value) {
    const currentVaryValue = headers.get('vary');

    if (currentVaryValue !== null) {
      const currentValues = currentVaryValue
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (!currentValues.includes(value)) {
        headers.set('Vary', [...currentValues, value].join(','));
      }
    } else {
      headers.set('Vary', value);
    }
  }
}
