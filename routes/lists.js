const { Router } = require('express');
const store = require('../store');
const { baseUrl } = require('../lib/urls');
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
  const list = store.peekListInvite(req.params.token);
  if (!list) {
    const stale = store.getListByShareToken(req.params.token);
    return res.status(stale ? 410 : 404).render('404', stale
      ? { code: 410, msg: 'Ce lien d\u2019invitation a expir\u00e9 (30 min, usage unique). Demande un nouveau lien.' }
      : {});
  }
  if (!res.locals.user) {
    req.session.afterLogin = req.originalUrl;
    return res.redirect('/login');
  }
  if (!res.locals.user.pseudo) {
    req.session.afterLogin = req.originalUrl;
    return res.redirect('/choose-pseudo');
  }
  store.consumeListInvite(req.params.token);
  store.addMember(list.id, req.session.userEmail);
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
  res.render('list', { list, user: res.locals.user, canEdit: store.canEditList(req.params.id, req.session.userEmail) });
});

router.get('/list/:id/members', requireAuth, (req, res) => {
  const list = store.getList(req.params.id);
  if (!list) return res.status(404).render('404');
  const members = store.getMembers(req.params.id);
  const canInvite = store.canEditList(req.params.id, req.session.userEmail);
  const token = store.getValidListInvite(req.params.id);
  res.render('members', { list, user: res.locals.user, members, canInvite, inviteUrl: token ? baseUrl(req) + '/join/' + token : null });
});

module.exports = router;
