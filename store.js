const bcrypt = require('bcryptjs');
const { db } = require('./db');

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function shortId(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createUser(email, password) {
  const existing = db.prepare('SELECT email FROM users WHERE email = ?').get(email);
  if (existing) return null;
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (email, password) VALUES (?, ?)').run(email, hash);
  return { email, pseudo: '' };
}

function getUserByEmail(email) {
  const user = db.prepare('SELECT email, pseudo FROM users WHERE email = ?').get(email);
  return user || null;
}

function verifyUser(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return false;
  return bcrypt.compareSync(password, user.password);
}

function setPseudo(email, pseudo) {
  const user = db.prepare('SELECT email FROM users WHERE email = ?').get(email);
  if (!user) return null;
  db.prepare('UPDATE users SET pseudo = ? WHERE email = ?').run(pseudo, email);
  return { email, pseudo };
}

function touchList(listId) {
  db.prepare('UPDATE lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(listId);
}

function createList(name, createdBy) {
  const id = shortId();
  const token = shortId(12);
  db.prepare('INSERT INTO lists (id, name, created_by, updated_at, share_token) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)').run(id, name, createdBy || null, token);
  if (createdBy) addMember(id, createdBy);
  return getList(id);
}

function getListsByUser(email) {
  return db.prepare(`
    SELECT DISTINCT l.id, l.name, l.updated_at, l.created_by,
      (SELECT COUNT(*) FROM items WHERE list_id = l.id) AS item_count
    FROM lists l
    LEFT JOIN list_members lm ON lm.list_id = l.id
    WHERE l.created_by = ? OR lm.user_email = ?
    ORDER BY l.updated_at DESC
  `).all(email, email);
}

function getList(id) {
  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(id);
  if (!list) return null;
  if (!list.share_token) {
    list.share_token = shortId(12);
    db.prepare('UPDATE lists SET share_token = ? WHERE id = ?').run(list.share_token, id);
  }
  list.items = db.prepare('SELECT id, name, quantity, checked, added_by AS addedBy FROM items WHERE list_id = ? ORDER BY created_at ASC').all(id);
  list.items.forEach(item => item.checked = !!item.checked);
  return list;
}

function getListByShareToken(token) {
  const list = db.prepare('SELECT * FROM lists WHERE share_token = ?').get(token);
  if (!list) return null;
  list.items = db.prepare('SELECT id, name, quantity, checked, added_by AS addedBy FROM items WHERE list_id = ? ORDER BY created_at ASC').all(list.id);
  list.items.forEach(item => item.checked = !!item.checked);
  return list;
}

function addItem(listId, { name, quantity = 1, addedBy = 'Anonyme' }) {
  const list = db.prepare('SELECT id FROM lists WHERE id = ?').get(listId);
  if (!list) return null;
  const existing = db.prepare('SELECT id, quantity FROM items WHERE list_id = ? AND LOWER(name) = LOWER(?)').get(listId, name);
  if (existing) {
    db.prepare('UPDATE items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
    touchList(listId);
    return { id: existing.id, name, quantity: existing.quantity + quantity, checked: false, addedBy };
  }
  const id = uid();
  db.prepare('INSERT INTO items (id, list_id, name, quantity, added_by) VALUES (?, ?, ?, ?, ?)').run(id, listId, name, quantity, addedBy);
  touchList(listId);
  return { id, name, quantity, checked: false, addedBy };
}

function changeItemQuantity(listId, itemId, delta) {
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND list_id = ?').get(itemId, listId);
  if (!item) return null;
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    db.prepare('DELETE FROM items WHERE id = ?').run(itemId);
    touchList(listId);
    return { deleted: true };
  }
  db.prepare('UPDATE items SET quantity = ? WHERE id = ?').run(newQty, itemId);
  touchList(listId);
  return { id: item.id, name: item.name, quantity: newQty, checked: !!item.checked, addedBy: item.added_by };
}

function toggleItem(listId, itemId) {
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND list_id = ?').get(itemId, listId);
  if (!item) return null;
  const newChecked = item.checked ? 0 : 1;
  db.prepare('UPDATE items SET checked = ? WHERE id = ?').run(newChecked, itemId);
  touchList(listId);
  return { id: item.id, name: item.name, checked: !!newChecked, addedBy: item.added_by };
}

function removeItem(listId, itemId) {
  const result = db.prepare('DELETE FROM items WHERE id = ? AND list_id = ?').run(itemId, listId);
  if (result.changes > 0) touchList(listId);
  return result.changes > 0;
}

function deleteList(listId, email) {
  const list = db.prepare('SELECT created_by FROM lists WHERE id = ?').get(listId);
  if (!list) return false;
  if (list.created_by !== email) return false;
  db.prepare('DELETE FROM items WHERE list_id = ?').run(listId);
  db.prepare('DELETE FROM lists WHERE id = ?').run(listId);
  return true;
}

function rotateShareToken(listId) {
  const token = shortId(12);
  db.prepare('UPDATE lists SET share_token = ? WHERE id = ?').run(token, listId);
  return token;
}

function addMember(listId, email) {
  db.prepare('INSERT OR IGNORE INTO list_members (list_id, user_email) VALUES (?, ?)').run(listId, email);
}

function removeMember(listId, email) {
  const list = db.prepare('SELECT created_by FROM lists WHERE id = ?').get(listId);
  if (!list || list.created_by === email) return false;
  db.prepare('DELETE FROM list_members WHERE list_id = ? AND user_email = ?').run(listId, email);
  return true;
}

function getMembers(listId) {
  return db.prepare(`
    SELECT u.email, u.pseudo, lm.joined_at
    FROM list_members lm
    JOIN users u ON u.email = lm.user_email
    WHERE lm.list_id = ?
    ORDER BY lm.joined_at ASC
  `).all(listId);
}

function getRecentItems(email, limit = 15) {
  return db.prepare(`
    SELECT i.id, i.name, i.quantity, i.added_by, i.created_at, l.name AS list_name, l.id AS list_id
    FROM items i
    JOIN lists l ON l.id = i.list_id
    LEFT JOIN list_members lm ON lm.list_id = l.id
    WHERE l.created_by = ? OR lm.user_email = ?
    ORDER BY i.created_at DESC
    LIMIT ?
  `).all(email, email, limit);
}

module.exports = { createList, getList, getListByShareToken, addItem, toggleItem, changeItemQuantity, removeItem, createUser, getUserByEmail, verifyUser, setPseudo, getListsByUser, deleteList, rotateShareToken, addMember, removeMember, getMembers, getRecentItems };
