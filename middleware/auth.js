function requireAuth(req, res, next) {
  if (!res.locals.user) return res.redirect('/login');
  next();
}

function requirePseudo(req, res, next) {
  if (!res.locals.user.pseudo) return res.redirect('/choose-pseudo');
  next();
}

module.exports = { requireAuth, requirePseudo };
