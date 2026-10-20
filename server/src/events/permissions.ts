type Listener = (event: object) => void;

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
}

const clients = new Map<any, SseClient>();

export function broadcast(event: object): void {
  for (const [res, client] of Array.from(clients.entries())) {
    // Drop anything that is no longer writable before touching it.
    if (client.closed || res.writableEnded || res.destroyed) {
      client.closed = true;
      clients.delete(res);
      continue;
    }

    try {
      client.listener(event);
    } catch {
      client.closed = true;
      clients.delete(res);
    }
  }
}

/**
 * Registers a response as an SSE client.
 *
 * The client is removed as soon as the connection goes away, which Node
 * reports through the response's `close` event (and the request's `close`
 * event when the request is aborted). Both are wired up so a half-open
 * connection cannot keep the entry alive.
 */
export function addClient(res: any, req?: any): void {
  const client: SseClient = {
    res,
    closed: false,
    listener: (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
  };

  clients.set(res, client);

  const cleanup = () => {
    client.closed = true;
    clients.delete(res);
  };

  res.on?.('close', cleanup);
  req?.on?.('close', cleanup);
}

/**
 * Removes a client explicitly. Safe to call for a client that is already
 * gone, and safe to call more than once.
 */
export function removeClient(res: any): void {
  const client = clients.get(res);
  if (client) {
    client.closed = true;
    clients.delete(res);
  }
}

/** Number of currently connected clients (used by the health check and tests). */
export function getClientCount(): number {
  return clients.size;
}
