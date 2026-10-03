# ShopList

Liste de courses **collaborative et temps réel**, installable comme une app sur mobile (PWA).

Crée tes listes, partage-les avec un lien, ajoute ta famille une fois pour toutes — tout se synchronise en direct quand plusieurs personnes sont dessus.

## Fonctionnalités

- **Listes partagées** — lien d'invitation (valide 30 min, usage unique), chaque membre voit les mêmes items en temps réel.
- **Temps réel** — ajouts, coches et suppressions diffusés en WebSocket, avec reconnexion automatique.
- **Famille** — ajoute des proches par email ou lien ; ils rejoignent automatiquement tes nouvelles listes. Droits par membre : **Éditeur** ou **Lecteur**.
- **Comptes** — inscription, pseudo (modifiable avec limites anti-abus), changement de mot de passe, suppression de compte.
- **PWA installable** — bannière d'installation, mises à jour automatiques via le numéro de version.

## Lancer

```bash
npm install
npm run dev    # app + tailwind watch
npm start      # prod
```

App : http://localhost:3000 (`PORT` pour changer).

## Env

```bash
PORT=3000
SESSION_SECRET=change-me
SITE_URL=https://mon-domaine.fr   # optionnel : base des liens d'invitation
```

## Notes

- DB SQLite locale : `db/data.db` (créée au démarrage, migrations non-destructives — ne pas supprimer ce dossier au déploiement).
- Version : source unique `package.json` → exposée sur `/api/version`, manifest, SW et footer. Bumper `package.json` suffit à forcer la MaJ des applis installées.
