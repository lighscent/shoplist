# ShopList

Liste de courses collaborative temps réel — Express, SQLite, WebSocket, PWA installable.

## Run

```bash
npm install
npm run dev    # app + tailwind watch
npm start      # prod
```

App: http://localhost:3000 (`PORT` pour changer).

## Env

```bash
PORT=3000
SESSION_SECRET=change-me
```

## Notes

- DB SQLite locale: `db/data.db` (créée au démarrage).
- PWA: `public/manifest.json`, `public/sw.js`, `public/js/app-version.js`.
- Version: source unique `package.json` → exposée sur `/api/version`, manifest, SW et footer. Bumper `package.json` suffit à forcer la MaJ des applis installées.
