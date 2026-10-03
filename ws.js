const WebSocket = require('ws');
const cookie = require('cookie');
const signature = require('cookie-signature');
const { SQLiteStore } = require('./db');

const SECRET = process.env.SESSION_SECRET || 'shoplist-dev-secret';
const sessionStore = new SQLiteStore();

// UID de session depuis le cookie (même secret que index.js) -> email, ou null
function sessionEmail(req) {
  return new Promise((resolve) => {
    try {
      const cookies = cookie.parse(req.headers.cookie || '');
      const raw = cookies['connect.sid'] || '';
      const sid = raw.startsWith('s:') ? signature.unsign(raw.slice(2), SECRET) : raw;
      if (!sid) return resolve(null);
      sessionStore.get(sid, (err, sess) => {
        if (err || !sess || !sess.userEmail) return resolve(null);
        resolve(sess.userEmail);
      });
    } catch { resolve(null); }
  });
}

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.listRooms = new Map();
    this.userRooms = new Map(); // email -> Set(ws)
  }

  init(server) {
    this.wss = new WebSocket.Server({ server });
    this.wss.on('connection', (ws, req) => {
      ws.listId = null;
      ws.userEmail = null;
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', async (raw) => {
        try {
          const { action, type, listId } = JSON.parse(raw);
          const act = action || type; // compat : anciens clients envoient `type`
          if (act === 'join' && listId) {
            if (ws.listId) {
              const prev = this.listRooms.get(ws.listId);
              if (prev) prev.delete(ws);
            }
            ws.listId = listId;
            if (!this.listRooms.has(listId)) this.listRooms.set(listId, new Set());
            this.listRooms.get(listId).add(ws);
          }
          if (act === 'join-user') {
            const email = await sessionEmail(req);
            if (!email) return;
            ws.userEmail = email;
            if (!this.userRooms.has(email)) this.userRooms.set(email, new Set());
            this.userRooms.get(email).add(ws);
          }
        } catch {}
      });
      ws.on('close', () => this.leave(ws));
    });
    // Heartbeat : tue les connexions mortes (mobile en veille, proxy coupé)
    setInterval(() => {
      for (const ws of this.wss.clients) {
        if (!ws.isAlive) { this.leave(ws); ws.terminate(); continue; }
        ws.isAlive = false;
        try { ws.ping(); } catch {}
      }
    }, 30000);
  }

  leave(ws) {
    if (ws.listId) {
      const room = this.listRooms.get(ws.listId);
      if (room) room.delete(ws);
      ws.listId = null;
    }
    if (ws.userEmail) {
      const room = this.userRooms.get(ws.userEmail);
      if (room) room.delete(ws);
      ws.userEmail = null;
    }
  }

  broadcast(listId, data = { type: 'update' }) {
    const clients = this.listRooms.get(listId);
    if (!clients) return;
    const msg = JSON.stringify(data);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }

  // Notifie les pages d'accueil (ajout/suppression de liste, nouveau partage...)
  notifyUsers(emails, data = { type: 'lists-changed' }) {
    const msg = JSON.stringify(data);
    for (const email of new Set(emails.filter(Boolean))) {
      const clients = this.userRooms.get(email);
      if (!clients) continue;
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      }
    }
  }
}

module.exports = new WebSocketManager();
