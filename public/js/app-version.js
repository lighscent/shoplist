(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  const KEY = 'shoplist-version';
  async function check() {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const { version } = await res.json();
      if (!version) return;
      const prev = localStorage.getItem(KEY);
      if (!prev) {
        localStorage.setItem(KEY, version);
        return;
      }
      if (prev !== version) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) await reg.update();
        } catch {}
        try {
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.startsWith('shoplist-')).map((k) => caches.delete(k)));
        } catch {}
        localStorage.setItem(KEY, version);
        location.reload();
      }
    } catch {}
  }
  check();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();
