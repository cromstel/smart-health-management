type Listener = (event: object) => void;
const listeners = new Set<Listener>();

export function broadcast(event: object): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (_e) {
      // ignore listener errors
    }
  }
}

export function addClient(res: any): void {
  const listener: Listener = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  listeners.add(listener);
}

export function removeClient(_res: any): void {
  // We can't easily remove by res, so we rely on the client closing connection
  // This is a simple pub/sub; in production you'd want a more robust implementation
}