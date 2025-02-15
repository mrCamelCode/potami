import { Context, type MiddlewareSubjects } from "@potami/core";
import { makeMiddlewareSubjects as testingMakeMiddlewareSubjects } from '@potami/testing';
import { FakeTime } from "@std/testing/time";
import {
  assert,
  assertEquals,
  assertFalse,
  assertGreater,
  assertNotEquals,
  assertRejects,
} from "assert";
import { afterEach, beforeEach, describe, test } from "bdd";
import type { Cookie } from "jsr:@std/http/cookie";
import { assertSpyCallArg, assertSpyCalls, type Spy, spy } from "mock";
import { cookies } from "../../deps.ts";
import { KvSessionStore } from "../kv-session-store.impl.ts";
import type { ISessionStore } from "../session-store.interface.ts";
import { getDefaultSessionContext, type Session } from "../session.model.ts";
import { handleSessioning } from "../sessioning.middleware.ts";

type SessionData = { name: string; username: string };
// type Context = SessionContext<SessionData>;

const sessionContext = new Context(getDefaultSessionContext<SessionData>());

const cookieName = "id";

const makeMiddlewareSubjects = testingMakeMiddlewareSubjects;

describe("handleSessioning", () => {
  const ttlMs = 10_000;

  let kv: Deno.Kv;
  let middleware: ReturnType<typeof handleSessioning<SessionData>>;
  let nonRefreshingMiddleware: ReturnType<
    typeof handleSessioning<SessionData>
  >;
  let subjects: MiddlewareSubjects;
  let store: ISessionStore<SessionData>;

  beforeEach(async () => {
    kv = await Deno.openKv(":memory:");

    store = new KvSessionStore<SessionData>({
      ttlMs,
      kvOptions: { kv },
    });

    middleware = handleSessioning<SessionData>({
      store,
      sessionContext,
      sessionCookieName: cookieName,
      sessionFetchOptions: {
        refresh: true,
      },
    });
    nonRefreshingMiddleware = handleSessioning<SessionData>({
      store,
      sessionContext,
      sessionCookieName: cookieName,
      sessionFetchOptions: {
        refresh: false,
      },
    });

    subjects = makeMiddlewareSubjects();
  });
  afterEach(() => {
    kv.close();
  });

  test(`the session is available on the context after the middleware runs`, async () => {
    assertEquals(subjects.getContext(sessionContext).session.id, '-1');
    assertRejects(() => subjects.getContext(sessionContext).setSessionData({ name: '', username: '' }));

    await middleware(subjects);

    assert(subjects.getContext(sessionContext).session.id !== '-1');
    // Doesn't reject.
    assert(await subjects.getContext(sessionContext).setSessionData({ name: '', username: ''}) === undefined);
  });
  test(`does not remove existing cookies`, async () => {
    subjects.resHeaders.set("My-Header", "something");

    await middleware(subjects);

    assert(subjects.resHeaders.get("Set-Cookie"));
    assertEquals(subjects.resHeaders.get("My-Header"), "something");
  });

  describe("no session on request", () => {
    test(`a new session is generated and appears on the set-cookie header of the response`, async () => {
      await middleware(subjects);

      const sessionId = subjects.getContext(sessionContext).session.id;
      const setCookies = cookies.getSetCookies(subjects.resHeaders);
      const sessionCookie = setCookies.find((cookie) =>
        cookie.name === cookieName
      )!;

      assertEquals(
        setCookies.filter((cookie) => cookie.name === cookieName).length,
        1,
      );
      assertEquals(sessionCookie.value, sessionId);
    });
  });

  describe("session on request", () => {
    let testSessionData: SessionData;
    let existingSession: Session<SessionData>;
    let requestWithCookieHeader: Request;
    beforeEach(async () => {
      testSessionData = { name: "JT", username: "mrCamelCode" };
      existingSession = await store.createSession(testSessionData);
      const headers = new Headers();
      headers.set("Cookie", `${cookieName}=${existingSession.id}`);

      requestWithCookieHeader = new Request("http://localhost:3000", {
        headers,
      });
    });

    test(`the session appears on the set-cookie header of the response`, async () => {
      const subjects = makeMiddlewareSubjects({
        req: requestWithCookieHeader,
      });

      await middleware(subjects);

      const setCookies = cookies.getSetCookies(subjects.resHeaders);
      const sessionCookie = setCookies.find((cookie) =>
        cookie.name === cookieName
      )!;

      assertEquals(
        setCookies.filter((cookie) => cookie.name === cookieName).length,
        1,
      );
      assertEquals(sessionCookie.value, existingSession.id);
    });
    test(`the session and its data appears on the context`, async () => {
      const subjects = makeMiddlewareSubjects({
        req: requestWithCookieHeader,
      });

      await middleware(subjects);

      assertEquals(subjects.getContext(sessionContext).session.data, testSessionData);
    });
    describe("refreshing", () => {
      describe("enabled", () => {
        test(`refreshable (unexpired) session is refreshed and appears on the set-cookie header of the response`, async () => {
          using time = new FakeTime();

          const subjects = makeMiddlewareSubjects({
            req: requestWithCookieHeader,
          });
          const originalExp =
            (await store.fetchSession(existingSession.id, { refresh: false }))!
              .exp;

          time.tick(ttlMs - 10);

          await middleware(subjects);

          const newExp = subjects.getContext(sessionContext).session.exp;

          const setCookies = cookies.getSetCookies(subjects.resHeaders);
          const sessionCookie = setCookies.find((cookie) =>
            cookie.name === cookieName
          )!;

          assertEquals(subjects.getContext(sessionContext).session.id, existingSession.id);
          assertEquals(subjects.getContext(sessionContext).session.data, existingSession.data);
          assertGreater(newExp, originalExp);

          assertEquals(
            setCookies.filter((cookie) => cookie.name === cookieName).length,
            1,
          );
          assertEquals(sessionCookie.value, existingSession.id);
        });
        test(`an expired session is not refreshed. A new session is generated appears on the set-cookie header of the response`, async () => {
          using time = new FakeTime();

          const subjects = makeMiddlewareSubjects({
            req: requestWithCookieHeader,
          });

          time.tick(ttlMs + 10);

          await middleware(subjects);

          const setCookies = cookies.getSetCookies(subjects.resHeaders);
          const sessionCookie = setCookies.find((cookie) =>
            cookie.name === cookieName
          )!;

          assertNotEquals(subjects.getContext(sessionContext).session.id, existingSession.id);
          assertNotEquals(subjects.getContext(sessionContext).session.data, existingSession.data);

          assertEquals(
            setCookies.filter((cookie) => cookie.name === cookieName).length,
            1,
          );
          assertEquals(sessionCookie.value, subjects.getContext(sessionContext).session.id);
        });
      });
      describe("disabled", () => {
        test(`unexpired session's exp is unchanged and appears on the set-cookie header of the response`, async () => {
          const subjects = makeMiddlewareSubjects({
            req: requestWithCookieHeader,
          });
          const originalExp =
            (await store.fetchSession(existingSession.id, { refresh: false }))!
              .exp;

          await nonRefreshingMiddleware(subjects);

          const newExp = subjects.getContext(sessionContext).session.exp;

          const setCookies = cookies.getSetCookies(subjects.resHeaders);
          const sessionCookie = setCookies.find((cookie) =>
            cookie.name === cookieName
          )!;

          assertEquals(subjects.getContext(sessionContext).session.id, existingSession.id);
          assertEquals(subjects.getContext(sessionContext).session.data, existingSession.data);
          assertEquals(newExp, originalExp);

          assertEquals(
            setCookies.filter((cookie) => cookie.name === cookieName).length,
            1,
          );
          assertEquals(sessionCookie.value, existingSession.id);
        });
        test(`expired session is discarded and new session is generated and appears on the set-cookie header of the response`, async () => {
          using time = new FakeTime();

          const subjects = makeMiddlewareSubjects({
            req: requestWithCookieHeader,
          });

          time.tick(ttlMs + 10);

          await nonRefreshingMiddleware(subjects);

          const setCookies = cookies.getSetCookies(subjects.resHeaders);
          const sessionCookie = setCookies.find((cookie) =>
            cookie.name === cookieName
          )!;

          assertNotEquals(subjects.getContext(sessionContext).session.id, existingSession.id);
          assertNotEquals(subjects.getContext(sessionContext).session.data, existingSession.data);

          assertEquals(
            setCookies.filter((cookie) => cookie.name === cookieName).length,
            1,
          );
          assertEquals(sessionCookie.value, subjects.getContext(sessionContext).session.id);
        });
      });
    });
  });

  describe("non-existent session on request", () => {
    let requestWithNonExistentSessionCookie: Request;
    beforeEach(() => {
      const headers = new Headers();
      headers.set("Cookie", `${cookieName}=123`);

      requestWithNonExistentSessionCookie = new Request(
        "http://localhost:3000",
        { headers },
      );
    });
    test(`a new session is generated and is present on the set-cookie header of the response`, async () => {
      const subjects = makeMiddlewareSubjects({
        req: requestWithNonExistentSessionCookie,
      });

      await middleware(subjects);

      const setCookies = cookies.getSetCookies(subjects.resHeaders);
      const sessionCookie = setCookies.find((cookie) =>
        cookie.name === cookieName
      )!;

      assert(!!subjects.getContext(sessionContext).session);
      assert(
        !!(await store.fetchSession(subjects.getContext(sessionContext).session.id, {
          refresh: false,
        })),
      );

      assertNotEquals(subjects.getContext(sessionContext).session.id, "123");

      assertEquals(
        setCookies.filter((cookie) => cookie.name === cookieName).length,
        1,
      );
      assertEquals(sessionCookie.value, subjects.getContext(sessionContext).session.id);
    });
  });

  describe("onReceivedInvalidSessionId", () => {
    let invalidIdFlaggingMiddleware: ReturnType<
      typeof handleSessioning<SessionData>
    >;
    let onReceivedInvalidSessionIdSpy: Spy;
    beforeEach(() => {
      onReceivedInvalidSessionIdSpy = spy();

      invalidIdFlaggingMiddleware = handleSessioning({
        store,
        sessionContext,
        sessionCookieName: cookieName,
        sessionFetchOptions: {
          refresh: true,
        },
        onReceivedInvalidSessionId: onReceivedInvalidSessionIdSpy,
      });
    });
    test(`invoked when a session is invalid`, async () => {
      const headers = new Headers();
      headers.set("Cookie", `${cookieName}=123`);

      const requestWithInvalidSessionCookie = new Request(
        "http://localhost:3000",
        { headers },
      );

      await invalidIdFlaggingMiddleware(
        makeMiddlewareSubjects({ req: requestWithInvalidSessionCookie }),
      );

      assertSpyCalls(onReceivedInvalidSessionIdSpy, 1);
      assertSpyCallArg(onReceivedInvalidSessionIdSpy, 0, 0, "123");
    });
    test(`not invoked when a session ID is valid`, async () => {
      const validId = (await store.createSession()).id;

      const headers = new Headers();
      headers.set("Cookie", `${cookieName}=${validId}`);

      const requestWithValidSessionCookie = new Request(
        "http://localhost:3000",
        { headers },
      );

      await invalidIdFlaggingMiddleware(
        makeMiddlewareSubjects({ req: requestWithValidSessionCookie }),
      );

      assertSpyCalls(onReceivedInvalidSessionIdSpy, 0);
    });
    test(`not invoked when the session ID is valid but the session is absent from the store`, async () => {
      using time = new FakeTime();

      const validId = (await store.createSession()).id;

      const headers = new Headers();
      headers.set("Cookie", `${cookieName}=${validId}`);

      const requestWithValidSessionCookie = new Request(
        "http://localhost:3000",
        { headers },
      );

      time.tick(ttlMs + 10);

      await store.purge();

      assertFalse(await store.fetchSession(validId, { refresh: false }));

      await invalidIdFlaggingMiddleware(
        makeMiddlewareSubjects({ req: requestWithValidSessionCookie }),
      );

      assertSpyCalls(onReceivedInvalidSessionIdSpy, 0);
    });
  });

  describe("setSessionData", () => {
    test(`the context's session.data and store are updated after calling with value`, async () => {
      await middleware(subjects);

      const newData = { name: "TJ", username: "SirPascalCode" };

      await subjects.getContext(sessionContext).setSessionData(newData);

      assertEquals(subjects.getContext(sessionContext).session.data, newData);
      assertEquals(
        (await store.fetchSession(subjects.getContext(sessionContext).session.id, { refresh: false }))
          ?.data,
        newData,
      );
    });
    test(`the context's session.data and store are updated after calling with setter`, async () => {
      const session = await store.createSession({
        name: "JT",
        username: "mrCamelCode",
      });

      const headers = new Headers();
      headers.set("Cookie", `${cookieName}=${session.id}`);

      const subjects = makeMiddlewareSubjects({
        req: new Request("http://localhost:3000", { headers }),
      });

      await middleware(subjects);

      const newData = { name: "TJ", username: "mrCamelCode" };

      await subjects.getContext(sessionContext).setSessionData((curr) => ({
        ...curr!,
        name: "TJ",
      }));

      assertEquals(subjects.getContext(sessionContext).session.data, newData);
      assertEquals(
        (await store.fetchSession(subjects.getContext(sessionContext).session.id, { refresh: false }))
          ?.data,
        newData,
      );
    });

    describe(`session expired during processing and doesn't exist in the store anymore`, () => {
      let testSessionData: SessionData;
      let existingSession: Session<SessionData>;
      let requestWithCookieHeader: Request;
      beforeEach(async () => {
        testSessionData = { name: "JT", username: "mrCamelCode" };
        existingSession = await store.createSession(testSessionData);
        const headers = new Headers();
        headers.set("Cookie", `${cookieName}=${existingSession.id}`);

        requestWithCookieHeader = new Request("http://localhost:3000", {
          headers,
        });
      });

      test(`a new session is made with the data provided`, async () => {
        using time = new FakeTime();

        const subjects = makeMiddlewareSubjects({ req: requestWithCookieHeader });

        await middleware(subjects);

        time.tick(ttlMs + 10);

        const newData = { name: "JT", username: "mrCamelCode" };

        await subjects.getContext(sessionContext).setSessionData(newData);

        assertNotEquals(subjects.getContext(sessionContext).session.id, existingSession.id);
        assertEquals(subjects.getContext(sessionContext).session.data, newData);
      });
      test(`a new session is made using the data setter, which receives the ORIGINAL session's data`, async () => {
        using time = new FakeTime();

        const subjects = makeMiddlewareSubjects({ req: requestWithCookieHeader });

        await middleware(subjects);

        time.tick(ttlMs + 10);

        await subjects.getContext(sessionContext).setSessionData((curr) => ({
          ...curr!,
          username: "SirPascalCode",
        }));

        assertNotEquals(subjects.getContext(sessionContext).session.id, existingSession.id);
        assertEquals(subjects.getContext(sessionContext).session.data, {
          name: "JT",
          username: "SirPascalCode",
        });
      });
      test(`the set-cookie header contains the newly generated session ID and not the original session's ID`, async () => {
        using time = new FakeTime();

        const subjects = makeMiddlewareSubjects({ req: requestWithCookieHeader });

        await middleware(subjects);

        const setCookiesBeforeCall = cookies.getSetCookies(subjects.resHeaders);
        const sessionCookieBeforeCall = setCookiesBeforeCall.find((cookie) =>
          cookie.name === cookieName
        )!;

        assertEquals(
          setCookiesBeforeCall.filter((cookie) => cookie.name === cookieName)
            .length,
          1,
        );
        assertEquals(sessionCookieBeforeCall.value, existingSession.id);

        time.tick(ttlMs + 10);

        const newData = { name: "JT", username: "mrCamelCode" };

        await subjects.getContext(sessionContext).setSessionData(newData);

        const setCookiesAfterCall = cookies.getSetCookies(subjects.resHeaders);
        const sessionCookieAfterCall = setCookiesAfterCall.find((cookie) =>
          cookie.name === cookieName
        )!;

        assertEquals(
          setCookiesAfterCall.filter((cookie) => cookie.name === cookieName)
            .length,
          1,
        );
        assertNotEquals(sessionCookieAfterCall.value, existingSession.id);
        assertEquals(sessionCookieAfterCall.value, subjects.getContext(sessionContext).session.id);

        assertNotEquals(subjects.getContext(sessionContext).session.id, existingSession.id);
        assertEquals(subjects.getContext(sessionContext).session.data, newData);
      });
    });
  });

  describe("cookieAttributes", () => {
    describe("secure", () => {
      test(`present when provided`, async () => {
        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {
            secure: true,
          },
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        assertEquals(sessionCookie.secure, true);
      });
      test(`not present when not provided`, async () => {
        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {
            secure: false,
          },
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        assertFalse(sessionCookie.secure);
      });
    });
    describe("httpOnly", () => {
      test(`present when provided`, async () => {
        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {
            httpOnly: true,
          },
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        assertEquals(sessionCookie.httpOnly, true);
      });
      test(`not present when not provided`, async () => {
        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {
            httpOnly: false,
          },
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        assertFalse(sessionCookie.httpOnly);
      });
    });
    describe("sameSite", () => {
      test(`reflects provided value`, async () => {
        for (
          const sameSite of ["Strict", "Lax", "None"] as Cookie["sameSite"][]
        ) {
          const middleware = handleSessioning({
            store,
            sessionContext,
            sessionCookieName: cookieName,
            cookieAttributes: {
              sameSite,
            },
          });

          await middleware(subjects);

          const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find(
            (cookie) => cookie.name === cookieName
          )!;

          assertEquals(sessionCookie.sameSite, sameSite);
        }
      });
    });
    describe("domain", () => {
      test(`reflects provided value`, async () => {
        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {
            domain: "example.com",
          },
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        assertEquals(sessionCookie.domain, "example.com");
      });
    });
    describe("path", () => {
      test(`reflects provided value`, async () => {
        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {
            path: "/path",
          },
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        assertEquals(sessionCookie.path, "/path");
      });
    });
    describe("maxAge", () => {
      test(`present when provided`, async () => {
        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {
            maxAge: 100,
          },
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        assertEquals(sessionCookie.maxAge, 100);
      });
      test(`not present when not provided`, async () => {
        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {},
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        assertFalse(sessionCookie.maxAge);
      });
    });
    describe("expires", () => {
      test(`present when provided`, async () => {
        const date = new Date();

        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {
            expires: () => date,
          },
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        const removeMs = (str: string) => str.replace(/\.\d{3}Z$/, "");
        // Deno's handling of cookies apparently yeets the MS of a date for expiration,
        // which is fine. Don't really care about the MS part of the date that much.
        assertEquals(removeMs(`${sessionCookie.expires}`), removeMs(`${date}`));
      });
      test(`not present when not provided`, async () => {
        const middleware = handleSessioning({
          store,
          sessionContext,
          sessionCookieName: cookieName,
          cookieAttributes: {},
        });

        await middleware(subjects);

        const sessionCookie = cookies.getSetCookies(subjects.resHeaders).find((
          cookie,
        ) => cookie.name === cookieName)!;

        assertFalse(sessionCookie.expires);
      });
    });
  });
});
