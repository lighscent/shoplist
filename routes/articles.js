const { Router } = require('express');
const store = require('../store');
const { requireAuth, requirePseudo } = require('../middleware/auth');

const router = Router();

function wantsJson(req) {
  return req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('Accept') || '').includes('application/json');
}

// Catalogue perso : ajout manuel nom + prix, prix modifiables
router.get('/articles', requireAuth, requirePseudo, (req, res) => {
  const email = req.session.userEmail;
  const lists = store.getListsByUser(email).filter(l => l.created_by === email || l.can_edit);
  res.render('articles', { items: store.getCatalog(email), lists, user: res.locals.user });
});

router.post('/articles/add', requireAuth, requirePseudo, (req, res) => {
  const r = store.addArticle(req.session.userEmail, req.body.name, req.body.price);
  if (!r) {
    if (wantsJson(req)) return res.status(400).json({ error: 'Nom requis, prix positif' });
    return res.redirect('/articles');
  }
  if (wantsJson(req)) return res.json({ ok: true, item: r });
  res.redirect('/articles');
});

router.post('/articles/update', requireAuth, requirePseudo, (req, res) => {
  const email = req.session.userEmail;
  // Renommage optionnel (anciens clients : pas de newName -> juste le prix)
  let finalName = (req.body.name || '').trim();
  if (req.body.newName != null && String(req.body.newName).trim() !== '') {
    const r = store.renameArticle(email, req.body.name, req.body.newName);
    if (r === 'empty') {
      if (wantsJson(req)) return res.status(400).json({ error: 'Nom requis' });
      return res.redirect('/articles');
    }
    if (r === 'exists') {
      if (wantsJson(req)) return res.status(400).json({ error: 'Un article porte déjà ce nom' });
      return res.redirect('/articles');
    }
    finalName = r.name;
  }
  const ok = store.setArticleInfo(email, finalName, req.body.price);
  if (!ok) {
    if (wantsJson(req)) return res.status(400).json({ error: 'Prix invalide' });
    return res.redirect('/articles');
  }
  if (wantsJson(req)) return res.json({ ok: true, item: { name: finalName } });
  res.redirect('/articles');
});

router.post('/articles/delete', requireAuth, requirePseudo, (req, res) => {
  store.deleteArticle(req.session.userEmail, req.body.name);
  if (wantsJson(req)) return res.json({ ok: true });
  res.redirect('/articles');
});

module.exports = router;
