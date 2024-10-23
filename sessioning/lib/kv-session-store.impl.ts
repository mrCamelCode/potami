import { uuid } from '../deps.ts';
import type { ISessionStore } from './session-store.interface.ts';
import type { Session, SessionDataSetter } from './session.model.ts';

export interface KvSessionStoreOptions {
  /**
   * The amount of time in MS that new sessions live. This value is added to the current time. Once the
   * resulting time has passed, the session is considered invalid and attempts to fetch it will behave
   * as though the session didn't exist in the store.
   *
   * This is also used to set the `expireIn` property of sessions in the KV instance, which will automatically
   * clean up sessions after they've expired according to the KV instance implementation's cleanup guarantees.
   * Even if the implementation does not guarantee immediate cleanup, this store will not yield an expired session
   * when fetching a session.
   *
   * Defaults to `7200000` (2 hours).
   */
  ttlMs?: number;
  /**
   * The amount of time in MS after expiration a session token is eligible to be refreshed. Refreshing happens
   * if `refresh` is true when fetching a session. If the current time is greater than or equal to `refreshWindowMs + session.exp`,
   * the session is not eligible for refresh and the store will not refresh the token.
   *
   * Defaults to `900000` (15 minutes)
   */
  refreshWindowMs?: number;
  kvOptions: {
    /**
     * The KV instance you'd like to use.
     */
    kv: Deno.Kv;
    /**
     * The name used for the root property the store uses. The store will actively manipulate this part of
     * the KV instance. If you're pointing this implementation at a KV instance you use for other things,
     * it's recommended to keep the default since it's namespaced, which helps in knowing where the information is
     * coming from and helps to avoid conflicting with other keys in your DB and accidentally overwriting things.
     *
     * Defaults to `'potami/sessioning'`.
     */
    sliceName?: string;
  };
}

/**
 * A session store implementation that uses Deno's KV as a backing.
 *
 * Deno's KV automatically cleans up keys that are given an `expireIn`
 * property, and this implementation makes use of that property. This
 * means that this implementation obviates the need to call `purge`
 * manually.
 */
export class KvSessionStore<T> implements ISessionStore<T> {
  #kv: Deno.Kv;
  #options: Required<KvSessionStoreOptions>;

  get #sliceName(): string {
    return this.#options.kvOptions!.sliceName!;
  }

  get #currentExpiryTime(): number {
    return Date.now() + this.#options.ttlMs;
  }

  constructor({
    ttlMs = 7_200_000,
    refreshWindowMs = 900_000,
    kvOptions: { kv, sliceName = 'potami/sessioning' },
  }: KvSessionStoreOptions) {
    this.#kv = kv;

    this.#options = {
      ttlMs,
      refreshWindowMs,
      kvOptions: {
        kv,
        sliceName,
      },
    };
  }

  async fetchSession(id: string, { refresh = true } = {}): Promise<Session<T> | undefined> {
    const session = await this.#getSession(id);

    if (session.value) {
      if (refresh && this.#isSessionWithinRefreshWindow(session.value)) {
        return this.#refreshSession(id, this.#kv);
      }

      return this.#isSessionExpired(session.value) ? undefined : session.value;
    }

    return undefined;
  }

  async createSession(data?: T): Promise<Session<T>> {
    let res: Deno.KvCommitResult | Deno.KvCommitError = { ok: false };
    let session: Session<T>;
    while (!res.ok) {
      const id = this.#generateSessionId();
      const key = this.#getSessionKey(id);

      session = {
        id,
        exp: this.#currentExpiryTime,
        data,
      };

      res = await this.#kv
        .atomic()
        .check({ key, versionstamp: null })
        .set(key, session, { expireIn: this.#options.ttlMs })
        .commit();
    }

    return session!;
  }

  deleteSession(id: Session<T>['id']): Promise<void> {
    return this.#kv.delete(this.#getSessionKey(id));
  }

  async purge(): Promise<void> {
    const sessionsRes = this.#kv.list<Session<T>>({ prefix: [this.#sliceName] });

    for await (const session of sessionsRes) {
      if (this.#isSessionExpired(session.value)) {
        this.deleteSession(session.value.id);
      }
    }
  }

  setSessionData(id: Session<T>['id'], data: T | undefined): Promise<Session<T> | undefined>;
  setSessionData(id: Session<T>['id'], dataSetter: SessionDataSetter<T>): Promise<Session<T> | undefined>;
  async setSessionData(
    id: Session<T>['id'],
    dataOrSetter: (T | undefined) | SessionDataSetter<T>
  ): Promise<Session<T> | undefined> {
    let res: Deno.KvCommitResult | Deno.KvCommitError = { ok: false };
    let newSession: Session<T>;
    while (!res.ok) {
      const session = await this.#getSession(id);

      if (session.value === null || this.#isSessionExpired(session.value)) {
        // No session, no data to set.
        return undefined;
      } else {
        const newData: T | undefined =
          typeof dataOrSetter === 'function'
            ? (dataOrSetter as SessionDataSetter<T>)(session.value.data)
            : dataOrSetter;

        newSession = { ...session.value, data: newData };

        res = await this.#kv
          .atomic()
          .check(session)
          .set([...this.#getSessionKey(id)], newSession)
          .commit();
      }
    }

    return newSession!;
  }

  isSessionIdValid(id: Session<T>['id']): boolean {
    return uuid.validate(id);
  }

  #getSession(id: Session<T>['id']): Promise<Deno.KvEntryMaybe<Session<T>>> {
    return this.#kv.get(this.#getSessionKey(id));
  }

  async #refreshSession(id: Session<T>['id'], kv: Deno.Kv): Promise<Session<T> | undefined> {
    let res = { ok: false };
    let refreshedSession: Session<T>;

    while (!res.ok) {
      const sessionRes = await this.#getSession(id);

      if (sessionRes.value) {
        refreshedSession = {
          ...sessionRes.value,
          exp: this.#currentExpiryTime,
        } as Session<T>;

        res = await kv
          .atomic()
          .check(sessionRes)
          .set(this.#getSessionKey(id), refreshedSession, {
            expireIn: this.#options.ttlMs,
          })
          .commit();
      } else {
        // The session is no longer in the DB and is therefore ineligible for refresh.
        return undefined;
      }
    }

    return refreshedSession!;
  }

  #getSessionKey(id: Session<T>['id']): string[] {
    return [this.#sliceName, id];
  }

  #isSessionExpired(session: Session<T>): boolean {
    return Date.now() >= session.exp;
  }

  #isSessionWithinRefreshWindow(session: Session<T>): boolean {
    return Date.now() < session.exp + this.#options.refreshWindowMs!;
  }

  #generateSessionId(): Session<T>['id'] {
    return crypto.randomUUID();
  }
}
