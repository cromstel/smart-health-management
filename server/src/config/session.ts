/**
 * The store the service keeps its sessions in.
 *
 * The sessions used to be kept in the memory of the process that served them.
 * Every visitor added to that memory, a restart signed everybody out at once,
 * and a deployment with more than one instance gave each instance its own set
 * of sessions, so a member of staff who moved between instances had to sign
 * in again. The store is now the database the rest of the service already
 * uses.
 *
 * The store is a convenience rather than a dependency. The sessions carry the
 * state of a signed-in session and little else, so a service that cannot
 * reach its database is already unable to do the work that matters, and it
 * must not stop serving because the sessions cannot be written down. When the
 * database cannot be reached, or when the table cannot be created, the
 * service keeps the sessions in memory and says so, and everything else about
 * it behaves as it did before.
 *
 * The store is made without waiting for anything. A module that waits at the
 * top level turns the whole entry point into a promise, and the platform
 * loads the entry point with `require()`, which cannot load a module graph
 * with a top-level wait in it: the service did not start at all. So the
 * handle is returned straight away, the sessions are kept in memory until the
 * database store has come up, and the switch happens in the background.
 */
import session, { type Store, type SessionData } from 'express-session';
import type { Request } from 'express';
import MySQLStoreFactory from 'express-mysql-session';
import pool, { databaseConnectionOptions, databaseName } from './database.js';

/** The table the sessions are kept in. */
const SESSION_TABLE = 'sessions';

/**
 * How long a session lives when the deployment has not said otherwise.
 *
 * Eight hours is longer than a shift and shorter than a week, which is the
 * span a session is meant to cover: long enough that a member of staff is
 * not signed out over a coffee, short enough that a forgotten browser does
 * not leave a session open for days.
 */
const DEFAULT_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/**
 * How long the database is given to answer the question of whether it is
 * there.
 *
 * The answer decides whether the service waits for the database or starts
 * without it, so the wait is bounded well below the driver's own connection
 * timeout: a service whose database is down should be serving in a second,
 * not in ten.
 */
const REACHABILITY_TIMEOUT_MS = 2000;

/** Which store the service is keeping its sessions in. */
export type SessionStoreBackend = 'mysql' | 'memory';

export interface SessionStoreHandle {
  /** The store the session middleware is given. */
  readonly store: Store;
  /** Which backend it is, so that the start-up log can say. */
  readonly backend: SessionStoreBackend;
  /** Resolves once the store has settled on one backend or the other. */
  readonly ready: Promise<void>;
  /** Stops the store when the process stops. */
  close: () => Promise<void>;
}

/**
 * How long a session may live.
 *
 * The lifetime of the stored session follows the lifetime of the cookie that
 * carries it, because a record that outlived its cookie would be a record
 * that nobody can use and nobody has to keep. A deployment that has not set a
 * lifetime gets the default above.
 */
export const sessionMaxAgeMs = (): number => {
  const raw = (process.env.SESSION_COOKIE_MAX_AGE ?? '').trim();
  if (raw === '') return DEFAULT_SESSION_MAX_AGE_MS;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(
      `[session] SESSION_COOKIE_MAX_AGE is not a number of milliseconds ("${raw}"), so sessions live for ${DEFAULT_SESSION_MAX_AGE_MS}ms instead.`
    );
    return DEFAULT_SESSION_MAX_AGE_MS;
  }
  return parsed;
};

/**
 * Whether the database is there.
 *
 * The question is asked with a deadline of its own, because the answer
 * decides whether the service starts with a database-backed store or without
 * one, and the driver's connection timeout is longer than a service should
 * spend on that decision.
 */
const databaseIsReachable = async (): Promise<boolean> => {
  let deadline: NodeJS.Timeout | undefined;
  const waited = new Promise<'waited'>((resolve) => {
    deadline = setTimeout(() => resolve('waited'), REACHABILITY_TIMEOUT_MS);
  });

  try {
    const answer = await Promise.race([
      pool
        .query('SELECT 1')
        .then(() => 'there' as const)
        .catch(() => 'not there' as const),
      waited,
    ]);
    return answer === 'there';
  } finally {
    if (deadline) clearTimeout(deadline);
  }
};

/**
 * A store that forwards to whichever store is current.
 *
 * The session middleware is given this one and keeps it. The sessions are
 * kept in memory until the database store has come up, and the forwarding
 * moves to the database store when it does. The middleware never has to be
 * rebuilt, and the service never has to wait.
 */
class DelegatingStore extends session.Store {
  private target: Store = new session.MemoryStore();

  /** The store the calls are forwarded to. */
  use(store: Store): void {
    this.target = store;
  }

  /** The store the calls are forwarded to right now. */
  get current(): Store {
    return this.target;
  }

  regenerate(req: Request, callback: (err?: unknown) => void): void {
    this.target.regenerate(req, callback);
  }

  load(sid: string, callback: (err: unknown, session?: SessionData) => void): void {
    this.target.load(sid, callback);
  }

  createSession(req: Request, value: SessionData): session.Session & SessionData {
    return this.target.createSession(req, value);
  }

  get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    this.target.get(sid, callback);
  }

  set(sid: string, value: SessionData, callback?: (err?: unknown) => void): void {
    this.target.set(sid, value, callback);
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.target.destroy(sid, callback);
  }

  touch(sid: string, value: SessionData, callback?: () => void): void {
    this.target.touch?.(sid, value, callback);
  }

  all(callback: (err: unknown, obj?: SessionData[] | { [sid: string]: SessionData } | null) => void): void {
    this.target.all?.(callback);
  }

  length(callback: (err: unknown, length?: number) => void): void {
    this.target.length?.(callback);
  }

  clear(callback?: (err?: unknown) => void): void {
    this.target.clear?.(callback);
  }
}

/**
 * The store for a service that has no database to keep its sessions in.
 *
 * The in-memory store is what the service used before it had one, and it is
 * the right answer for a service that cannot reach its database: the sessions
 * work, they are simply not shared between instances and they do not survive
 * a restart.
 */
/**
 * The store the service keeps its sessions in.
 *
 * The handle comes back straight away. The database is asked whether it is
 * there, and the store is asked whether it came up, in the background: the
 * service is serving before either answer arrives, and the sessions are kept
 * in memory until the database store is ready to take them.
 */
export const createSessionStore = (): SessionStoreHandle => {
  const delegating = new DelegatingStore();
  let backend: SessionStoreBackend = 'memory';
  let databaseStore: InstanceType<ReturnType<typeof MySQLStoreFactory>> | null = null;

  const connection = databaseConnectionOptions();
  const target = `${connection.host}:${connection.port}/${databaseName()}`;

  const ready = (async (): Promise<void> => {
    if (!(await databaseIsReachable())) {
      console.warn(
        `[session] The database at ${target} could not be reached, so the sessions are kept in memory for this run. ` +
          'They are not shared between instances and they do not survive a restart.'
      );
      return;
    }

    const MySQLStore = MySQLStoreFactory(session);
    const store = new MySQLStore(
      {
        // The stored session lives for as long as the cookie that carries it.
        expiration: sessionMaxAgeMs(),
        // The table is created when it is missing, so an installation that has
        // not been migrated still comes up with a working store.
        createDatabaseTable: true,
        // The pool is not the store's to end, so the store is told to leave it
        // alone when it is closed.
        endConnectionOnClose: false,
        schema: { tableName: SESSION_TABLE },
      },
      // The store shares the service's own pool: one set of credentials, one
      // set of connections, and the same TLS settings the rest of the service
      // reaches the database with.
      pool
    );

    try {
      // The store creates its own table, and it does that in the background.
      // Waiting for it here means a service that cannot have the table is
      // found out while it is starting, rather than on the first request that
      // needs a session.
      await store.onReady();
      databaseStore = store;
      delegating.use(store as unknown as Store);
      backend = 'mysql';
      console.log(`[session] The sessions are kept in the database at ${target}.`);
    } catch {
      console.warn(
        `[session] The sessions table at ${target} could not be created, so the sessions are kept in memory for this run. ` +
          'They are not shared between instances and they do not survive a restart.'
      );
      await store.close();
    }
  })();

  // The failure is reported inside; this only stops it from becoming an
  // unhandled rejection.
  ready.catch(() => undefined);

  return {
    store: delegating,
    get backend(): SessionStoreBackend {
      return backend;
    },
    ready,
    close: async () => {
      if (databaseStore) {
        await databaseStore.close();
        databaseStore = null;
      }
    },
  };
};
