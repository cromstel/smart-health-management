/**
 * The MySQL session store, as this service uses it.
 *
 * The package ships no types of its own, so the part of it the service
 * touches is described here: the factory that takes the session module, the
 * options it accepts, and the promise it settles once the store is ready.
 *
 * The methods are described as they behave at run time rather than as the
 * session middleware's own types describe them. The store answers with a
 * promise and also accepts the callback the session middleware passes, which
 * is why the store is bridged onto the middleware's type where it is handed
 * over.
 */
declare module 'express-mysql-session' {
  interface MySQLStoreOptions {
    /** The database the sessions are kept in. */
    database?: string;
    /** Whether the store creates its table when the table is missing. */
    createDatabaseTable?: boolean;
    /** How long a session may live, in milliseconds. */
    expiration?: number;
    /** How often the expired sessions are cleared, in milliseconds. */
    checkExpirationInterval?: number;
    /** Whether the expired sessions are cleared at all. */
    clearExpired?: boolean;
    /** Whether closing the store also ends the connection it was given. */
    endConnectionOnClose?: boolean;
    /** The table the sessions are kept in, and the columns they are kept in. */
    schema?: {
      tableName?: string;
      columnNames?: {
        session_id?: string;
        expires?: string;
        data?: string;
      };
    };
    [option: string]: unknown;
  }

  interface MySQLStore {
    get(sid: string, callback?: (err: unknown, session?: unknown) => void): Promise<unknown>;
    set(sid: string, session: unknown, callback?: (err?: unknown) => void): Promise<void>;
    destroy(sid: string, callback?: (err?: unknown) => void): Promise<void>;
    touch(sid: string, session: unknown, callback?: (err?: unknown) => void): Promise<void>;
    all(): Promise<unknown>;
    clear(): Promise<void>;
    length(): Promise<number>;
    /** Settles when the store is ready, and fails when it could not be set up. */
    onReady(): Promise<void>;
    /** Stops the store and releases what it holds. */
    close(): Promise<void>;
  }

  type MySQLStoreConstructor = new (
    options?: MySQLStoreOptions,
    connection?: unknown
  ) => MySQLStore;

  /** Takes the session module and answers with the store for it. */
  const MySQLStoreFactory: (session: unknown) => MySQLStoreConstructor;

  export default MySQLStoreFactory;
}
