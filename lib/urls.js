// Absolute site URL for invite links.
// Set SITE_URL in production (e.g. https://shoplist.example.com),
// otherwise derived from the request (proxy-aware, no trust-proxy needed).
function baseUrl(req) {
  const env = (process.env.SITE_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  return proto + '://' + req.get('host');
}

module.exports = { baseUrl };
