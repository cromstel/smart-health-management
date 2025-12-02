import type { Response } from 'express'

type Client = { res: Response }
const clients: Client[] = []

export function addClient(res: Response) {
  clients.push({ res })
}

export function removeClient(res: Response) {
  const idx = clients.findIndex(c => c.res === res)
  if (idx >= 0) clients.splice(idx, 1)
}

export function broadcast(event: any) {
  const data = `data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`
  for (const c of clients) {
    try {
      c.res.write(data)
    } catch (_e) { /* Error ignored as per design */ }
  }
}