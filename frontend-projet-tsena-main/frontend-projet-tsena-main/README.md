# TSENA Virtuel — Frontend

Marketplace malgache (React 19 + TypeScript strict + Vite 8) intégrée au backend NestJS [`tsena-backend`](../tsena-backend).
**Toutes les données affichées proviennent de l'API** : aucune donnée simulée, aucun repli sur des mocks en cas de panne.

## Démarrage

```bash
cp .env.example .env            # VITE_API_URL=http://localhost:3000/api
npm install
npm run dev                     # http://localhost:5173 (URLs propres : /produits, /connexion… ; /api est proxifié vers le backend)
```

Le backend doit tourner (`npm run start:dev` dans `tsena-backend`, Postgres + MinIO démarrés) et autoriser l'origine du frontend (`CORS_ORIGIN`).

| Script | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | génération du sitemap + `tsc -b` (typage strict, tests inclus) + `vite build` + `verify:bundle` |
| `npm run verify:bundle` | contrôle du bundle `dist/` : aucun cycle d'imports entre chunks, `charts` hors de la fermeture initiale, évaluation réelle de l'entrée dans Node + jsdom (reproduit « n is not a function ») |
| `npm run sitemap` | régénère `public/sitemap.xml` (pages publiques + fiches produits actives si l'API répond) |
| `npm run preview` | sert le build de production localement |
| `npm run typecheck` | vérification TypeScript seule |
| `npm run lint` | `oxlint` |
| `npm test` | tests Vitest + Testing Library (backend simulé au niveau de l'adaptateur Axios) |

## Déploiement (SPA en mode history)

Le routage utilise `BrowserRouter` (URLs propres, indexables). L'hébergeur doit donc renvoyer `index.html`
pour toute route inconnue :

- **Render (site statique)** : `render.yaml` (Blueprint : rewrite `/* → /index.html`, en-têtes de cache, variables).
  Render **ignore** `public/_redirects` : pour un service créé depuis le tableau de bord, ajoutez la règle dans
  *Settings → Redirects/Rewrites* — Source `/*`, Destination `/index.html`, Action **Rewrite** — et les en-têtes
  *Settings → Headers* : `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`, `/index.html` → `no-cache` ;
- **Vercel** : `vercel.json` (rewrites, les appels `/api/*` sont exclus) ;
- **Netlify / Cloudflare Pages** : `public/_redirects` ;
- **Nginx** : `try_files $uri $uri/ /index.html;` (+ `location /api/ { proxy_pass http://api:3000; }`) ;
- hébergement statique sans réécriture possible : `VITE_ROUTER_MODE=hash` bascule sur `HashRouter`.

Variables de build : `VITE_API_URL` (URL publique de l'API, **préfixe `/api` inclus**, ex. `https://backend-projet-tsena.onrender.com/api` —
si seule l'origine est fournie, le client ajoute `/api` lui-même) et `VITE_SITE_URL` (URL canonique du site, utilisée pour `canonical`,
Open Graph, `robots.txt` et le sitemap). Ces variables sont lues **au build** : toute modification exige un nouveau déploiement.
En production, servir le dossier `dist/` avec des en-têtes de cache longs sur `assets/*` (fichiers hashés) et
`Cache-Control: no-cache` sur `index.html`.

**Découpage en chunks** (`vite.config.ts`, `codeSplitting.groups`) : chaque groupe inclut toutes ses dépendances
(`includeDependenciesRecursively`, valeur par défaut) afin qu'aucun chunk n'importe `common`. Un cycle
(`react → common → query → react`) fait évaluer un chunk avant celui dont il dépend et l'application reste bloquée sur
« Chargement de Tsena… » avec `TypeError: n is not a function` dans la console — `npm run verify:bundle` fait échouer
le build dans ce cas, avant tout déploiement.

Après un déploiement, un onglet resté ouvert peut demander un chunk de l'ancien build (`/assets/common-XXXX.js` → 404) :
`src/lib/chunk-recovery.ts` intercepte `vite:preloadError` / « Failed to fetch dynamically imported module » et recharge la page
une seule fois (garde-fou `sessionStorage`) au lieu d'afficher une page blanche.

Côté backend (Render Web Service) : `CORS_ORIGIN` doit contenir l'origine du frontend, `APP_URL` l'URL du frontend (liens des
e-mails), et la base doit être initialisée (`npm run seed`) pour disposer du compte administrateur.

## Architecture

```
Page ──► hook TanStack Query (src/hooks/queries | mutations) ──► service (src/api/*.api.ts) ──► apiClient (src/api/client.ts) ──► NestJS
```

- **`src/api/client.ts`** — instance Axios unique : `baseURL = VITE_API_URL`, timeout, injection du Bearer token, **un seul** `POST /auth/refresh` sur 401 (requêtes concurrentes mises en file puis rejouées), purge + événement `sessionExpired` si le refresh échoue, normalisation de toutes les erreurs en `ApiError`.
- **`src/lib/api-error.ts`** — `getApiErrorMessage()` : messages français pour 400/401/403/404/409/422/429/500/503, réseau, timeout ; erreurs de validation par champ (`getFieldErrors`). Jamais de texte Axios brut.
- **`src/context/AuthContext.tsx`** — source de vérité de session (`user`, `isAuthenticated`, `isLoading`, `login`, `register`, `logout`, `refreshSession`). Restauration via `GET /auth/me` au démarrage ; déconnexion **toujours confirmée** (`ConfirmDialog` global) ; expiration → cache protégé vidé, toast, redirection `/connexion`.
- **Gardes** — `ProtectedRoute` (état réel + rôle, écran d'attente pendant la restauration, jamais de redirection prématurée) et `GuestRoute`. Le backend reste l'autorité : un 403 affiche un message explicite.
- **`src/lib/query-keys.ts`** — clés centralisées ; chaque mutation n'invalide que les requêtes concernées et émet un toast (message backend prioritaire, dédoublonné).
- **États UI** — `LoadingState` (skeletons), `ErrorState` (+ Réessayer), `EmptyState`, `ConfirmDialog` (« Suppression... », pas de double envoi), `DataTable` responsive.
- **`ErrorBoundary`** — distingue erreur React / réseau / session / accès refusé / métier / API et propose l'action adaptée.
- **Code-splitting** — les espaces client, vendeur et admin sont chargés à la demande (`React.lazy`).

## Fonctionnalités (alignées sur le document de conception)

- Catalogue public, fiche produit avec **carte vendeur** (note moyenne, ancienneté, badges), promotions/sélection/nouveautés.
- Panier serveur, tunnel de commande, paiement mobile money **sous séquestre**, confirmation de réception → libération des fonds.
- Litiges : signalement acheteur/vendeur avec preuves, arbitrage administrateur, blocage/remboursement de l'escrow.
- Avis et réputation, badges automatiques.
- Espaces : client (commandes, avis, litiges, profil), vendeur (produits + images, commandes, revenus, boutique, avis, litiges), admin (utilisateurs, vendeurs, produits à valider, catégories, commandes, paiements & escrow, litiges, rapports & journal d'audit).
- Fonctionnalités sans endpoint backend (carnet d'adresses, campagnes promotionnelles, paramètres) : page « Fonctionnalité indisponible », jamais de simulation.

La matrice complète *route frontend → composant → hooks → endpoint → auth/rôle* est dans [`docs/ROUTES_MATRIX.md`](docs/ROUTES_MATRIX.md).

## Tests

`src/test/mock-backend.ts` remplace l'adaptateur Axios par un backend simulé qui parle le format NestJS (`{ success, message, data, meta }` / `{ success:false, message, errors }`, pannes réseau, timeouts). Les intercepteurs, le refresh et la normalisation d'erreurs réels sont donc exercés. Couverture actuelle :

- client HTTP : token, refresh unique et concurrent, expiration de session, réseau/timeout ;
- mapping des erreurs HTTP → messages français, erreurs de champ ;
- `ProtectedRoute` : restauration de session, 401, backend arrêté, rôles, accès direct par URL ;
- connexion : redirection par rôle, 401, double clic, validation locale, réseau ;
- catalogue vendeur : liste, suppression confirmée (annulation, double clic, 403), Réessayer ;
- en-tête : déconnexion confirmée, purge du cache, serveur injoignable ;
- panier : affichage, vide, retrait confirmé, erreur métier de stock, visiteur ;
- `ErrorBoundary` : classification des erreurs ;
- page d'accueil : backend arrêté → états d'erreur + Réessayer, aucune donnée fictive.

## Conventions

- Pas d'URL backend en dur : `env.apiUrl` (`src/lib/env.ts`).
- Pas d'appel Axios hors `src/api/`.
- Toute action destructive passe par `ConfirmDialog` ; tout mutation hook gère toast + invalidation.
- Libellés de statuts en français centralisés dans `src/lib/format.ts`.
