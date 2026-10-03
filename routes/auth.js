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

module.exports = router;
