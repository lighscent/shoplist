const { Router } = require('express');
const store = require('../store');
const ws = require('../ws');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Lecture seule : 403 sur toute modification si le membre est en droit "voir"
function requireCanEdit(req, res, next) {
  if (!store.canEditList(req.params.id, req.session.userEmail)) {
    return res.status(403).json({ error: 'Lecture seule' });
  }
  next();
}

router.get('/list/:id', requireAuth, (req, res) => {
  const list = store.getList(req.params.id);
  if (!list) return res.status(404).json({ error: 'Liste introuvable' });
  res.json(list);
});

router.post('/list/:id/items', requireAuth, requireCanEdit, (req, res) => {
  const { name, quantity, addedBy } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est requis' });
  const qty = parseInt(quantity, 10) || 1;
  const item = store.addItem(req.params.id, { name: name.trim(), quantity: qty, addedBy: addedBy || 'Anonyme' });
  if (!item) return res.status(404).json({ error: 'Liste introuvable' });
  const list = store.getList(req.params.id);
  ws.broadcast(req.params.id, { type: 'item-added', item: { name: item.name, addedBy: item.addedBy }, listName: list ? list.name : '' });
  res.json(item);
});

router.post('/list/:id/items/:itemId/toggle', requireAuth, requireCanEdit, (req, res) => {
  const item = store.toggleItem(req.params.id, req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Introuvable' });
  ws.broadcast(req.params.id);
  res.json(item);
});

router.post('/list/:id/items/:itemId/quantity', requireAuth, requireCanEdit, (req, res) => {
  const delta = parseInt(req.body.delta, 10) || 0;
  if (delta === 0) return res.status(400).json({ error: 'Delta invalide' });
  const result = store.changeItemQuantity(req.params.id, req.params.itemId, delta);
  if (!result) return res.status(404).json({ error: 'Introuvable' });
  ws.broadcast(req.params.id);
  res.json(result);
});

router.delete('/list/:id/items/:itemId', requireAuth, requireCanEdit, (req, res) => {
  const ok = store.removeItem(req.params.id, req.params.itemId);
  if (!ok) return res.status(404).json({ error: 'Introuvable' });
  ws.broadcast(req.params.id);
  res.json({ ok: true });
});

router.delete('/list/:id/checked', requireAuth, requireCanEdit, (req, res) => {
  const list = store.getList(req.params.id);
  if (!list) return res.status(404).json({ error: 'Liste introuvable' });
  const removed = store.clearCheckedItems(req.params.id);
  ws.broadcast(req.params.id);
  res.json({ ok: true, removed });
});

router.delete('/list/:id', requireAuth, (req, res) => {
  const ok = store.deleteList(req.params.id, req.session.userEmail);
  if (!ok) return res.status(403).json({ error: 'Action non autorisee' });
  res.json({ ok: true });
});

router.get('/list/:id/members', requireAuth, (req, res) => {
  const members = store.getMembers(req.params.id);
  res.json(members);
});

// Génère un lien d'invitation à usage unique (30 min) — rien n'est pré-généré avant cet appel
router.post('/list/:id/invite', requireAuth, (req, res) => {
  if (!store.getList(req.params.id)) return res.status(404).json({ error: 'Liste introuvable' });
  if (!store.canEditList(req.params.id, req.session.userEmail)) return res.status(403).json({ error: 'Action non autorisee' });
  res.json({ ok: true, token: store.createListInvite(req.params.id) });
});

router.delete('/list/:id/members/:email', requireAuth, requireCanEdit, (req, res) => {
  const ok = store.removeMember(req.params.id, req.params.email);
  if (!ok) return res.status(403).json({ error: 'Action non autorisee' });
  ws.broadcast(req.params.id);
  res.json({ ok: true });
});

router.get('/recent', requireAuth, (req, res) => {
  const items = store.getRecentItems(req.session.userEmail);
  res.json(items);
});

module.exports = router;
