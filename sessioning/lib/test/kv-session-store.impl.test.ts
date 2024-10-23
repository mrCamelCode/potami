import { assert, assertEquals, assertGreater } from 'assert';
import { afterEach, beforeEach, describe, test } from 'bdd';
import { KvSessionStore } from '../kv-session-store.impl.ts';
import type { Session } from '../session.model.ts';

interface TestSessionData {
  name: string;
  username: string;
}

type TestSession = Session<TestSessionData>;

const sliceName = 'sessions';

function getSessionKey(id: Session<TestSessionData>['id']): string[] {
  return [sliceName, id];
}

describe('KvSessionStore', () => {
  let kv: Deno.Kv;
  beforeEach(async () => {
    kv = await Deno.openKv(':memory:');
  });
  afterEach(() => {
    kv?.close();
  });

  describe('fetchSession', () => {
    test(`fetching an existent and non-expired session without additional options returns the session`, async () => {
      const id = '123';

      const session: TestSession = {
        id,
        exp: Date.now() + 1_000_000,
        data: {
          name: 'JT',
          username: 'mrCamelCode',
        },
      };

      await kv.set(getSessionKey(id), session);

      const store = new KvSessionStore({ kvOptions: { kv, sliceName } });

      const fetchedSession = await store.fetchSession(id, { refresh: false });

      assertEquals(fetchedSession, session);
    });

    describe('refresh', () => {
      test(`the fetch returns undefined when refresh is false and the session is expired`, async () => {
        const id = '123';

        const session: TestSession = {
          id,
          exp: Date.now() - 100,
          data: {
            name: 'JT',
            username: 'mrCamelCode',
          },
        };

        await kv.set(getSessionKey(id), session);

        const store = new KvSessionStore({ kvOptions: { kv, sliceName } });

        const fetchedSession = await store.fetchSession(id, { refresh: false });

        assertEquals(fetchedSession, undefined);
      });

      describe('refreshed when...', () => {
        test(`the session is expired and it's within the refresh window`, async () => {
          const id = '123';

          const session: TestSession = {
            id,
            exp: Date.now() - 100,
            data: {
              name: 'JT',
              username: 'mrCamelCode',
            },
          };

          await kv.set(getSessionKey(id), session);

          const store = new KvSessionStore({ refreshWindowMs: 100_000, kvOptions: { kv, sliceName } });

          const fetchedSession = await store.fetchSession(id, { refresh: true });

          assert(!!fetchedSession);
          assertEquals({ ...fetchedSession, exp: undefined }, { ...session, exp: undefined });
          assertGreater(fetchedSession.exp, session.exp);
        });
        test(`the session hasn't expired yet`, async () => {
          const id = '123';

          const session: TestSession = {
            id,
            exp: Date.now() + 1_000_000,
            data: {
              name: 'JT',
              username: 'mrCamelCode',
            },
          };

          await kv.set(getSessionKey(id), session);

          const store = new KvSessionStore({ refreshWindowMs: 100_000, kvOptions: { kv, sliceName } });

          const fetchedSession = await store.fetchSession(id, { refresh: true });

          assert(!!fetchedSession);
          assertEquals({ ...fetchedSession, exp: undefined }, { ...session, exp: undefined });
          assertGreater(fetchedSession.exp, session.exp);
        });
      });
      describe('NOT refreshed when...', () => {
        test(`the session is expired and past its refresh window`, async () => {
          const id = '123';

          const session: TestSession = {
            id,
            exp: Date.now() - 10_000,
            data: {
              name: 'JT',
              username: 'mrCamelCode',
            },
          };

          await kv.set(getSessionKey(id), session);

          const store = new KvSessionStore({ refreshWindowMs: 100, kvOptions: { kv, sliceName } });

          const fetchedSession = await store.fetchSession(id, { refresh: true });

          assertEquals(fetchedSession, undefined);
        });
      });
    });
  });

  describe('createSession', () => {
    test(`creates a new session when no data is provided`, async () => {
      const store = new KvSessionStore({ kvOptions: { kv, sliceName } });

      const createdSession = await store.createSession();

      assert(!!createdSession);
      assertEquals(createdSession.data, undefined);
    });
    test(`creates a new session and attaches the provided data when provided`, async () => {
      const data: TestSessionData = {
        name: 'JT',
        username: 'mrCamelCode',
      };

      const store = new KvSessionStore({ kvOptions: { kv, sliceName } });

      const createdSession = await store.createSession(data);

      assert(!!createdSession);
      assertEquals(createdSession.data, data);
    });
    test(`IDs do not conflict when many new sessions are requested`, async () => {
      const store = new KvSessionStore({ kvOptions: { kv, sliceName } });

      const numSessions = 100_000;

      await Promise.all(new Array(numSessions).fill(0).map(() => store.createSession()));

      const sessionsRes = kv.list<TestSessionData>({ prefix: [sliceName] });

      let actualNumSessions = 0;
      for await (const _res of sessionsRes) {
        actualNumSessions += 1;
      }

      assertEquals(actualNumSessions, numSessions);
    });
  });

  describe('deleteSession', () => {
    test(`successfully removes an existent session`, async () => {
      const id = '123';

      await kv.set(getSessionKey(id), {
        id,
        exp: Date.now() + 1_000_000,
      } as TestSession);

      const store = new KvSessionStore({ kvOptions: { kv, sliceName } });

      const existingSessionBeforeDeletion = await kv.get(getSessionKey(id));

      assert(existingSessionBeforeDeletion.value !== null);

      await store.deleteSession(id);

      const existingSessionAfterDeletion = await kv.get(getSessionKey(id));

      assert(existingSessionAfterDeletion.value === null);
    });
    test(`nothing happens when a non-existent session is removed`, async () => {
      const id = '123';

      await kv.set(getSessionKey(id), {
        id,
        exp: Date.now() + 1_000_000,
      } as TestSession);

      const store = new KvSessionStore({ kvOptions: { kv, sliceName } });

      await store.deleteSession('321');

      const existingSessionsRes = kv.list<TestSession>({ prefix: [sliceName] });

      const sessions: TestSession[] = [];
      for await (const s of existingSessionsRes) {
        sessions.push(s.value);
      }

      assertEquals(sessions.length, 1);
      assertEquals(sessions[0].id, '123');
    });
  });

  describe('purge', () => {
    test(`all expired sessions are removed and unexpired sessions are unaffected`, async () => {
      await kv
        .atomic()
        .set(getSessionKey('123'), {
          id: '123',
          exp: Date.now() - 100,
        } as TestSession)
        .set(getSessionKey('321'), {
          id: '321',
          exp: Date.now() + 100_000,
        } as TestSession)
        .set(getSessionKey('1'), {
          id: '1',
          exp: Date.now() - 100_000,
        } as TestSession)
        .commit();

      const store = new KvSessionStore({ kvOptions: { kv, sliceName } });

      await store.purge();

      const existingSessionsRes = kv.list<TestSession>({ prefix: [sliceName] });

      const sessions: TestSession[] = [];
      for await (const s of existingSessionsRes) {
        sessions.push(s.value);
      }

      assertEquals(sessions.length, 1);
      assertEquals(sessions[0].id, '321');
    });
  });

  describe('setSessionData', () => {
    test(`the session data is overwritten when data is provided`, async () => {
      const id = '123';

      const exp = Date.now() + 1_000_000;

      await kv.set(getSessionKey(id), {
        id,
        exp,
        data: {
          name: 'JT',
          username: 'mrCamelCode',
        },
      } as TestSession);

      const store = new KvSessionStore({ kvOptions: { kv, sliceName } });

      const newData = {
        name: 'TJ',
        username: 'SirPascalCode',
      };

      await store.setSessionData(id, newData);

      const session = (await kv.get<TestSession>(getSessionKey(id))).value;

      assert(!!session);
      assertEquals(session, {
        id,
        exp,
        data: newData,
      });
    });
    test(`providing a setter function and appropriately sets the data returned from the setter`, async () => {
      const id = '123';

      const exp = Date.now() + 1_000_000;

      await kv.set(getSessionKey(id), {
        id,
        exp,
        data: {
          name: 'JT',
          username: 'mrCamelCode',
        },
      } as TestSession);

      const store = new KvSessionStore<TestSessionData>({ kvOptions: { kv, sliceName } });

      await store.setSessionData(id, (curr) => {
        return curr
          ? {
              ...curr,
              username: 'Completely Different',
            }
          : undefined;
      });

      const session = (await kv.get<TestSession>(getSessionKey(id))).value;

      assert(!!session);
      assertEquals(session, {
        id,
        exp,
        data: {
          name: 'JT',
          username: 'Completely Different',
        },
      });
    });
    test(`does nothing when setting the data of a non-existent session`, async () => {
      const id = '123';

      const exp = Date.now() + 1_000_000;

      await kv.set(getSessionKey(id), {
        id,
        exp,
        data: {
          name: 'JT',
          username: 'mrCamelCode',
        },
      } as TestSession);

      const store = new KvSessionStore<TestSessionData>({ kvOptions: { kv, sliceName } });

      await store.setSessionData('321', (curr) => {
        return curr
          ? {
              ...curr,
              username: 'Completely Different',
            }
          : undefined;
      });

      const existingSessionsRes = kv.list<TestSession>({ prefix: [sliceName] });

      const sessions: TestSession[] = [];
      for await (const s of existingSessionsRes) {
        sessions.push(s.value);
      }

      assertEquals(sessions.length, 1);
      assertEquals(sessions[0], {
        id,
        exp,
        data: {
          name: 'JT',
          username: 'mrCamelCode',
        },
      });
    });
  });
});
