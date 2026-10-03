const { Router } = require('express');
const store = require('../store');
const { requireAuth, requirePseudo } = require('../middleware/auth');

const router = Router();

router.get('/', requireAuth, requirePseudo, (req, res) => {
  const lists = store.getListsByUser(req.session.userEmail);
  const recentItems = store.getRecentItems(req.session.userEmail);
  res.render('index', { lists, recentItems });
});

router.post('/lists', requireAuth, requirePseudo, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.redirect('/');
  const wantsJson = req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('Accept') || '').includes('application/json');
  const trimmed = name.trim();
  const duplicate = store.getListsByUser(req.session.userEmail)
    .find((l) => l.created_by === req.session.userEmail && l.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (duplicate) {
    if (wantsJson) return res.status(409).json({ error: 'duplicate', name: trimmed, existingId: duplicate.id });
    const lists = store.getListsByUser(req.session.userEmail);
    const recentItems = store.getRecentItems(req.session.userEmail);
    return res.render('index', { lists, recentItems, warningName: trimmed, existingList: duplicate });
  }
  const list = store.createList(trimmed, req.session.userEmail);
  if (wantsJson) return res.json({ id: list.id });
  res.redirect('/list/' + list.id);
});

router.get('/join/:token', (req, res) => {
  const list = store.getListByShareToken(req.params.token);
  if (!list) return res.status(404).render('404');
  if (!res.locals.user) {
    req.session.afterLogin = req.originalUrl;
    return res.redirect('/login');
  }
  if (!res.locals.user.pseudo) {
    req.session.afterLogin = req.originalUrl;
    return res.redirect('/choose-pseudo');
  }
  store.addMember(list.id, req.session.userEmail);
  store.rotateShareToken(list.id);
  res.redirect('/list/' + list.id);
});

router.get('/list', (req, res) => {
  const { id } = req.query;
  if (!id) return res.redirect('/');
  res.redirect('/list/' + id);
});

router.get('/list/:id', requireAuth, (req, res) => {
  const list = store.getList(req.params.id);
  if (!list) return res.status(404).render('404');
  res.render('list', { list, user: res.locals.user });
});

router.get('/list/:id/members', requireAuth, (req, res) => {
  const list = store.getList(req.params.id);
  if (!list) return res.status(404).render('404');
  const members = store.getMembers(req.params.id);
  res.render('members', { list, user: res.locals.user, members });
});

module.exports = router;
