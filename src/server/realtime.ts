import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

interface ClientMeta {
  ws: WebSocket;
  isAdmin: boolean;
  userId?: number;
  orderNumbers: Set<string>;
}

const clients = new Set<ClientMeta>();

export function initWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const meta: ClientMeta = {
      ws,
      isAdmin: false,
      orderNumbers: new Set(),
    };
    clients.add(meta);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'subscribe') {
          if (typeof msg.orderNumber === 'string' && msg.orderNumber.trim()) {
            meta.orderNumbers.add(msg.orderNumber.trim().toUpperCase());
          }
          if (typeof msg.userId === 'number') {
            meta.userId = msg.userId;
          }
          if (msg.isAdmin === true) {
            meta.isAdmin = true;
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      clients.delete(meta);
    });

    ws.on('error', () => {
      clients.delete(meta);
    });
  });

  return wss;
}

export function broadcastOrderEvent(
  eventType: 'order:created' | 'order:updated',
  order: {
    id: number;
    orderNumber: string;
    userId: number | null;
    status: string;
    paymentStatus: string;
    updatedAt?: Date | string;
  }
) {
  const payload = JSON.stringify({
    type: eventType,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      updatedAt: order.updatedAt || new Date().toISOString(),
    },
  });

  for (const client of clients) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    const matchesOrder = client.orderNumbers.has(order.orderNumber.toUpperCase());
    const matchesUser = order.userId !== null && client.userId === order.userId;
    if (client.isAdmin || matchesOrder || matchesUser) {
      client.ws.send(payload);
    }
  }
}
