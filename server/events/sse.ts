import type { Response } from 'express';

interface SseClient {
  id: string;
  res: Response;
}

const clients = new Set<SseClient>();

export function addSseClient(res: Response): () => void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);

  const client: SseClient = { id: Math.random().toString(36).slice(2), res };
  clients.add(client);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(client);
    }
  }, 20_000);

  return () => {
    clearInterval(heartbeat);
    clients.delete(client);
  };
}

export function broadcastEvent(event: 'wo.updated' | 'notification', payload: unknown) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(msg);
    } catch {
      clients.delete(client);
    }
  }
}
