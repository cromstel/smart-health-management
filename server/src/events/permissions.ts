type Listener = (event: object) => void;

/**
 * How often an idle stream is pinged, in milliseconds.
 *
 * A held-open response is invisible to the network between events, so an
 * intermediary that forgets the connection — or a client that has gone away
 * without closing the socket — leaves a half-open stream behind. The ping
 * gives the write a chance to fail, which is what actually detects the dead
 * connection. It is also what keeps proxies from closing an idle stream.
 */
export const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * How many streams one account may hold at once.
 *
 * A stream is a socket that stays open, so an account that opens them in a
 * loop can exhaust the process's file descriptors and the registry itself. A
 * browser normally holds one stream per tab; the ceiling leaves room for
 * reconnect overlap without allowing a client to take the channel down.
 */
export const MAX_STREAMS_PER_ACCOUNT = 5;

/**
 * The account a stream belongs to.
 *
 * Recorded when the connection is registered so the registry is not an
 * anonymous set of responses: an operator can see how many streams an account
 * holds, and the per-account ceiling can be enforced. The hospital is the
 * tenant the account is confined to, so an event that concerns one hospital is
 * not delivered to another.
 */
export interface SseClientContext {
  userId?: number | string | null;
  hospitalId?: number | null;
  platformWide?: boolean;
}

/**
 * Who an event is meant for.
 *
 * Omitted entirely means every connected client — the role events are
 * installation-wide, because roles are not owned by a hospital. A hospital is
 * named when the event concerns only that tenant's records.
 */
export interface SseAudience {
  hospitalId?: number | null;
}

/**
 * A connected SSE client.
 *
 * The response is tracked instead of a bare listener, so a client that
 * disconnects can actually be removed. The previous implementation only kept
 * the listener in a set and `removeClient` was a no-op, so the set grew
 * without bound and `broadcast` kept writing to closed responses.
 */
interface SseClient {
  res: any;
  listener: Listener;
  closed: boolean;
  userId: string | null;
  hospitalId: number | null;
  platformWide: boolean;
  heartbeat: ReturnType<typeof setInterval> | null;
}

const clients = new Map<any, SseClient>();

const normalizeId = (value: number | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const asString = String(value);
  return asString.length > 0 ? asString : null;
};

/**
 * Whether a client is in the audience for an event.
 *
 * A platform-wide account sees across the installation, so it is always in the
 * audience. A caller with no hospital is confined to nothing, so it only
 * receives events that name no hospital at all — an event that names a
 * hospital is not its business.
 */
const isInAudience = (client: SseClient, audience?: SseAudience): boolean => {
  if (!audience || audience.hospitalId === undefined) return true;
  if (client.platformWide) return true;

  const target = audience.hospitalId;
  if (target === null) return client.hospitalId === null;
  if (client.hospitalId === null) return false;
  return Number(client.hospitalId) === Number(target);
};

export function broadcast(event: object, audience?: SseAudience): void {
  for (const [res, client] of Array.from(clients.entries())) {
    // Drop anything that is no longer writable before touching it.
    if (client.closed || res.writableEnded || res.destroyed) {
      discard(res, client);
      continue;
    }

    if (!isInAudience(client, audience)) continue;

    try {
      client.listener(event);
    } catch {
      discard(res, client);
    }
  }
}

const discard = (res: any, client: SseClient): void => {
  client.closed = true;
  clients.delete(res);
  if (client.heartbeat) {
    clearInterval(client.heartbeat);
    client.heartbeat = null;
  }
  try {
    res.end?.();
  } catch {
    // Already gone; nothing to close.
  }
};

/**
 * Registers a response as an SSE client.
 *
 * The client is removed as soon as the connection goes away, which Node
 * reports through the response's `close` event (and the request's `close`
 * event when the request is aborted). Both are wired up so a half-open
 * connection cannot keep the entry alive, and the heartbeat is how a socket
 * that died without either event is eventually noticed.
 */
export function addClient(res: any, req?: any, context?: SseClientContext): void {
  const client: SseClient = {
    res,
    closed: false,
    userId: normalizeId(context?.userId),
    hospitalId: context?.hospitalId ?? null,
    platformWide: context?.platformWide === true,
    heartbeat: null,
    listener: (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
  };

  clients.set(res, client);

  // The comment frame is a valid no-op to the client parser: it keeps the
  // connection warm and proves the socket still accepts a write.
  client.heartbeat = setInterval(() => {
    if (client.closed || res.writableEnded || res.destroyed) {
      discard(res, client);
      return;
    }
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      discard(res, client);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Never hold the process open for a stream, and never let a heartbeat keep a
  // closing server alive.
  client.heartbeat.unref?.();

  const cleanup = () => {
    discard(res, client);
  };

  res.on?.('close', cleanup);
  res.on?.('error', cleanup);
  req?.on?.('close', cleanup);
}

/**
 * Removes a client explicitly. Safe to call for a client that is already
 * gone, and safe to call more than once.
 */
export function removeClient(res: any): void {
  const client = clients.get(res);
  if (client) {
    discard(res, client);
  }
}

/** Number of currently connected clients (used by the health check and tests). */
export function getClientCount(): number {
  return clients.size;
}

/** Number of streams one account holds, so a single account cannot exhaust the registry. */
export function getClientCountForUser(userId: number | string | null | undefined): number {
  const target = normalizeId(userId);
  if (target === null) return 0;

  let count = 0;
  for (const client of clients.values()) {
    if (client.userId === target) count += 1;
  }
  return count;
}
