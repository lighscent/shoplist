# ShopList — AGENTS.md

Express 5 + EJS + SQLite (`better-sqlite3`) + `ws`. Mobile-first PWA (`max-w-sm`, viewport no-zoom, main actions ≥ 48px).

## Commands

- `npm install` then `npm start` (`node index.js`, port `PORT` or 3000)
- `npm run dev` — nodemon + tailwind watch (needs `concurrently`, `nodemon`)
- `npm run build:css` — rebuild `public/css/main.css` (Tailwind v4 CLI)
- No tests (`npm test` is an `echo` placeholder). Verify with `node --check <file>`.

## Wiring

- `index.js` — entrypoint: dynamic `/api/version`, `/manifest.json`, `/sw.js` (all no-cache), static `public/`, session (SQLiteStore), `res.locals.user` + `res.locals.version`, then routers.
- `routes/auth.js` (`/login`, `/register`, `/choose-pseudo`, `/profile`, `/account/delete`), `routes/lists.js` (`/`, `/lists`, `/join/:token`, `/list/:id`), `routes/api.js` (`/api/...`, auth required except `/api/version`).
- `middleware/auth.js` — `requireAuth`, `requirePseudo` (no pseudo → `/choose-pseudo`).
- `store.js` — all SQL. `db.js` — creates `db/data.db` + tables (`users`, `lists`, `items`, `sessions`, `list_members`, `pseudo_changes`).

## Version system (PWA update)

Single source: `package.json` `version`. Bumping it updates `/api/version`, manifest (`start_url: /?v=<v>`), SW cache name, and footer — Chrome then refreshes installed WebAPKs. Client check: `public/js/app-version.js` (purge `shoplist-*` caches + reload on mismatch). Views reference it via `<%= locals.version %>` (`?v=` on manifest/script URLs).

## Gotchas

- `public/css/main.css` is compiled. If you can't run `build:css`, reuse classes already present in it (grep first) + inline `style=` for anything new.
- Views: footer version is `fixed bottom-0 pointer-events-none`; keep `pb-10` spacer on page containers so content isn't hidden.
- `getListsByUser` uses `GROUP BY l.id` (join fan-out) — keep it.
- Rules enforced in code: pseudo changes max 2 / rolling 7 days + 15 min gap (`pseudo_changes`, initial choice free, resubmitting same pseudo is free); password min 4 chars; `deleteUser` deletes owned lists + items + memberships + sessions.
- No `node_modules` committed; `db/` sqlite file is runtime-created, don't delete it in prod.
