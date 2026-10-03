const { Router } = require('express');
const store = require('../store');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/login', (req, res) => {
  if (res.locals.user) return res.redirect('/');
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.render('login', { error: 'Veuillez remplir tous les champs' });
  if (!store.verifyUser(email, password)) return res.render('login', { error: 'Email ou mot de passe invalide' });
  req.session.userEmail = email;
  const user = store.getUserByEmail(email);
  const redirect = req.session.afterLogin || (user && user.pseudo ? '/' : '/choose-pseudo');
  delete req.session.afterLogin;
  res.redirect(redirect);
});

router.get('/register', (req, res) => {
  if (res.locals.user) return res.redirect('/');
  res.render('register', { error: null });
});

router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.render('register', { error: 'Veuillez remplir tous les champs' });
  if (password.length < 4) return res.render('register', { error: 'Le mot de passe doit contenir au moins 4 caracteres' });
  const user = store.createUser(email, password);
  if (!user) return res.render('register', { error: 'Cet email est deja inscrit' });
  req.session.userEmail = user.email;
  const redirect = req.session.afterLogin || '/choose-pseudo';
  delete req.session.afterLogin;
  res.redirect(redirect);
});

router.get('/choose-pseudo', requireAuth, (req, res) => {
  if (res.locals.user.pseudo) return res.redirect('/');
  res.render('pseudo', { error: null });
});

router.post('/choose-pseudo', requireAuth, (req, res) => {
  const { pseudo } = req.body;
  if (!pseudo || !pseudo.trim()) return res.render('pseudo', { error: 'Veuillez choisir un pseudo' });
  if (pseudo.trim().length < 2) return res.render('pseudo', { error: 'Le pseudo doit contenir au moins 2 caracteres' });
  const user = store.setPseudo(req.session.userEmail, pseudo.trim());
  if (!user) return res.redirect('/login');
  const redirect = req.session.afterLogin || '/';
  delete req.session.afterLogin;
  res.redirect(redirect);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/profile', requireAuth, (req, res) => {
  const pseudoStatus = store.getPseudoChangeStatus(req.session.userEmail);
  res.render('profile', { error: null, pseudoStatus });
});

router.post('/profile/pseudo', requireAuth, (req, res) => {
  const email = req.session.userEmail;
  const wantsJson = req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('Accept') || '').includes('application/json');
  const pseudoStatus = store.getPseudoChangeStatus(email);
  const fail = (status, error) => wantsJson
    ? res.status(status).json({ error })
    : res.render('profile', { error, pseudoStatus: store.getPseudoChangeStatus(email) });
  const { pseudo } = req.body;
  if (!pseudo || !pseudo.trim()) return fail(400, 'Veuillez choisir un pseudo');
  if (pseudo.trim().length < 2) return fail(400, 'Le pseudo doit contenir au moins 2 caracteres');
  if (pseudo.trim() === res.locals.user.pseudo) {
    return wantsJson
      ? res.json({ ok: true, unchanged: true, pseudo: res.locals.user.pseudo, remaining: pseudoStatus.remaining })
      : res.redirect('/profile');
  }
  if (pseudoStatus.count7d >= store.PSEUDO_MAX_PER_WEEK) return fail(429, 'Limite atteinte : 2 changements de pseudo par 7 jours maximum');
  if (pseudoStatus.minsSinceLast != null && pseudoStatus.minsSinceLast < store.PSEUDO_MIN_GAP_MIN) {
    const wait = Math.ceil(store.PSEUDO_MIN_GAP_MIN - pseudoStatus.minsSinceLast);
    return fail(429, 'Attends encore ' + wait + ' min avant de rechanger de pseudo');
  }
  store.setPseudo(email, pseudo.trim());
  store.recordPseudoChange(email);
  if (wantsJson) return res.json({ ok: true, pseudo: pseudo.trim(), remaining: store.getPseudoChangeStatus(email).remaining });
  res.redirect('/profile');
});

router.post('/account/delete', requireAuth, (req, res) => {
  const email = req.session.userEmail;
  store.deleteUser(email);
  req.session.destroy(() => res.redirect('/register'));
});

router.post('/profile/password', requireAuth, (req, res) => {
  const email = req.session.userEmail;
  const wantsJson = req.get('X-Requested-With') === 'XMLHttpRequest' || (req.get('Accept') || '').includes('application/json');
  const pseudoStatus = store.getPseudoChangeStatus(email);
  const fail = (status, error) => wantsJson
    ? res.status(status).json({ error })
    : res.render('profile', { error, success: null, pseudoStatus });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return fail(400, 'Veuillez remplir tous les champs');
  if (newPassword.length < 4) return fail(400, 'Le nouveau mot de passe doit contenir au moins 4 caracteres');
  if (!store.verifyUser(email, currentPassword)) return fail(400, 'Mot de passe actuel incorrect');
  store.updatePassword(email, newPassword);
  if (wantsJson) return res.json({ ok: true });
  return res.render('profile', { error: null, success: 'Mot de passe mis à jour', pseudoStatus });
});

module.exports = router;
