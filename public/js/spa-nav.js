(function() {
  if (window.__spaNav) return;
  window.__spaNav = true;
  window.__pageCleanup = window.__pageCleanup || [];

  // Popup de confirmation globale (créée à la demande, survit aux swaps SPA)
  window.confirmPopup = function(msg) {
    return new Promise(function(resolve) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45);';
      var card = document.createElement('div');
      card.style.cssText = 'background:#fff;border-radius:16px;padding:20px;max-width:20rem;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center;';
      var p = document.createElement('p');
      p.style.cssText = 'font-size:14px;color:#1f2937;margin:0 0 16px;font-weight:500;';
      p.textContent = msg;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;';
      var no = document.createElement('button');
      no.type = 'button';
      no.textContent = 'Annuler';
      no.style.cssText = 'flex:1;padding:10px;border-radius:12px;background:#f3f4f6;color:#374151;font-size:14px;font-weight:600;border:none;cursor:pointer;';
      var yes = document.createElement('button');
      yes.type = 'button';
      yes.textContent = 'Confirmer';
      yes.style.cssText = 'flex:1;padding:10px;border-radius:12px;background:#ef4444;color:#fff;font-size:14px;font-weight:600;border:none;cursor:pointer;';
      function done(v) { if (ov.parentNode) ov.parentNode.removeChild(ov); resolve(v); }
      no.addEventListener('click', function() { done(false); });
      yes.addEventListener('click', function() { done(true); });
      ov.addEventListener('click', function(e) { if (e.target === ov) done(false); });
      row.appendChild(no);
      row.appendChild(yes);
      card.appendChild(p);
      card.appendChild(row);
      ov.appendChild(card);
      document.body.appendChild(ov);
    });
  };

  function runCleanups() {
    var fns = window.__pageCleanup;
    window.__pageCleanup = [];
    for (var i = 0; i < fns.length; i++) { try { fns[i](); } catch (e) {} }
  }

  function isInternalLink(a) {
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    try {
      return new URL(href, window.location.href).origin === window.location.origin;
    } catch (e) { return false; }
  }

  function execScripts() {
    var olds = document.querySelectorAll('body script');
    for (var i = 0; i < olds.length; i++) {
      var old = olds[i];
      if (old.src && old.src.indexOf('spa-nav.js') !== -1) continue;
      if (old.dataset && old.dataset.spaDone) continue;
      var s = document.createElement('script');
      if (old.src) { s.src = old.src; }
      else { s.textContent = old.textContent; }
      old.dataset.spaDone = '1';
      old.replaceWith(s);
    }
  }

  // Cache HTML des pages : affichage instantané + revalidation en fond (stale-while-revalidate)
  var pageCache = new Map();
  var MAX_CACHE = 20;

  function cacheKey(url) {
    var h = url.indexOf('#');
    return h === -1 ? url : url.slice(0, h);
  }

  function cachePut(url, html) {
    var k = cacheKey(url);
    if (pageCache.has(k)) pageCache.delete(k);
    pageCache.set(k, html);
    while (pageCache.size > MAX_CACHE) {
      var oldest = pageCache.keys().next().value;
      pageCache.delete(oldest);
    }
  }

  window.__spaForget = function(url) {
    try { pageCache.delete(cacheKey(url || window.location.pathname)); } catch (e) {}
  };

  function renderHtml(html, url, push) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc || !doc.body || !doc.body.children.length) throw new Error('parse');
    if (doc.title) document.title = doc.title;
    document.body.replaceWith(doc.body);
    if (push !== false) { try { history.pushState({}, '', url); } catch (e) {} }
    window.scrollTo(0, 0);
    execScripts();
  }

  async function fetchPage(url) {
    var res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    var html = await res.text();
    // Pas de cache si erreur ou redirection (ex: /login -> page après login)
    if (!res.ok || res.redirected) { var e = new Error('http'); e.html = html; e.useHtml = !res.ok ? false : true; throw e; }
    return html;
  }

  async function goPage(url, push) {
    var key = cacheKey(url);
    var cached = pageCache.get(key);
    if (cached) {
      try {
        runCleanups();
        renderHtml(cached, url, push);
      } catch (e) { window.location.href = url; return; }
      // Revalidation silencieuse : si le frais diffère, on met à jour
      try {
        var fresh = await fetchPage(url);
        if (fresh !== cached) {
          cachePut(url, fresh);
          runCleanups();
          renderHtml(fresh, url, false);
        }
      } catch (e) {}
      return;
    }
    try {
      runCleanups();
      var html = await fetchPage(url);
      cachePut(url, html);
      renderHtml(html, url, push);
    } catch (e) {
      if (e && e.useHtml) {
        try { runCleanups(); renderHtml(e.html, url, push); return; }
        catch (err) {}
      }
      window.location.href = url;
    }
  }
  window.goPage = function(url) { goPage(url, true); };

  document.addEventListener('click', function(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !isInternalLink(a)) return;
    var u;
    try { u = new URL(a.getAttribute('href'), window.location.href); } catch (e) { return; }
    if (u.pathname === window.location.pathname && u.search === window.location.search && u.hash) {
      try { window.location.hash = u.hash; } catch (e) {}
      e.preventDefault();
      return;
    }
    e.preventDefault();
    goPage(u.pathname + u.search + u.hash, true);
  });

  window.addEventListener('popstate', function() {
    goPage(window.location.pathname + window.location.search, false);
  });
})();
