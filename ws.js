const WebSocket = require('ws');

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.listRooms = new Map();
  }

  init(server) {
    this.wss = new WebSocket.Server({ server });
    this.wss.on('connection', (ws) => {
      ws.listId = null;
      ws.on('message', (raw) => {
        try {
          const { action, listId } = JSON.parse(raw);
          if (action === 'join' && listId) {
            if (ws.listId) {
              const prev = this.listRooms.get(ws.listId);
              if (prev) prev.delete(ws);
            }
            ws.listId = listId;
            if (!this.listRooms.has(listId)) this.listRooms.set(listId, new Set());
            this.listRooms.get(listId).add(ws);
          }
        } catch {}
      });
      ws.on('close', () => {
        if (ws.listId) {
          const clients = this.listRooms.get(ws.listId);
          if (clients) clients.delete(ws);
        }
      });
    });
  }

  broadcast(listId, data = { type: 'update' }) {
    const clients = this.listRooms.get(listId);
    if (!clients) return;
    const msg = JSON.stringify(data);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }
}

module.exports = new WebSocketManager();
