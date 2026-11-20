# Tsena Backend API

API REST NestJS pour la marketplace Tsena — Plateforme e-commerce malgache avec paiement en escrow.

## Stack Technique

- **Framework** : NestJS 10 + TypeScript 5
- **Base de données** : PostgreSQL 15 + TypeORM
- **Auth** : JWT (access + refresh tokens), Passport, bcrypt
- **Stockage** : S3-compatible via AWS SDK — **un seul bucket** (`assets` en production), images et pièces jointes incluses
- **Documentation** : Swagger / OpenAPI
- **Validation** : class-validator + class-transformer

## Installation

```bash
cd tsena-backend
npm install
cp .env.example .env
# Éditer .env avec vos valeurs
```

## Configuration (.env)

Copier `.env.example` → `.env` (les noms ci-dessous sont ceux réellement lus par l'application).

```env
# Application
NODE_ENV=development            # production sur l'hébergeur
PORT=3000
API_PREFIX=api                  # toutes les routes sont servies sous /api
CORS_ORIGIN=http://localhost:5173   # origine(s) du frontend, séparées par des virgules
APP_URL=http://localhost:5173       # URL du frontend (liens des e-mails)

# Base de données — au choix :
DATABASE_HOST=localhost         # mode 1 : variables séparées (local / Docker)
DATABASE_PORT=5432
DATABASE_USER=tsena
DATABASE_PASSWORD=tsena_secret
DATABASE_NAME=tsena_db
# DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB   # mode 2 : URL unique (Render…), prioritaire
# DATABASE_SSL=true             # auto : true si DATABASE_URL distante
DATABASE_SYNCHRONIZE=false      # schéma géré par les migrations (exécutées auto au démarrage) ; true = régénérer depuis les entités

# Compte administrateur : aucune variable — le premier compte inscrit comme « Administrateur » devient admin
# ADMIN_SELF_REGISTRATION=false # interdit ce canal (l'admin vient alors de `npm run seed`)

# E-mails — SMTP via nodemailer (vide = mode « log » : aucun envoi, contenu dans les logs)
MAIL_HOST=smtp.gmail.com        # Gmail : smtp.gmail.com | Brevo : smtp-relay.brevo.com | local (Mailpit) : localhost
MAIL_PORT=587                   # 587 = STARTTLS (défaut) | 465 = TLS implicite | 1025 = Mailpit
MAIL_USER=votre.adresse@gmail.com
MAIL_PASSWORD=                  # Gmail : mot de passe d'application (16 caractères, validation en 2 étapes requise)
MAIL_FROM=votre.adresse@gmail.com   # Gmail : obligatoirement l'adresse du compte ; Brevo : expéditeur validé
MAIL_FROM_NAME=Tsena Marketplace
MAIL_REPLY_TO=support@tsena.mg  # optionnel
# MAIL_DRIVER=log               # forcer le mode log même avec MAIL_HOST (préproduction)
# MAIL_SECURE=false             # auto selon le port ; MAIL_REQUIRE_TLS, MAIL_TLS_REJECT_UNAUTHORIZED,
# MAIL_TIMEOUT_MS=10000         # MAIL_POOL, MAIL_VERIFY_ON_BOOT : voir .env.example

# JWT, bcrypt, stockage S3-compatible (bucket unique), MVola/Airtel : voir .env.example
```

| Variable | Obligatoire | Défaut | Rôle |
|---|---|---|---|
| `MAIL_HOST` | pour envoyer | — | Hôte SMTP ; absent → mode « log » |
| `MAIL_PORT` | non | `587` | `587` STARTTLS, `465` TLS implicite |
| `MAIL_USER` / `MAIL_PASSWORD` | selon le serveur | — | Identifiants SMTP (jamais exposés par l'API) |
| `MAIL_FROM` | non | `MAIL_USER` puis `noreply@tsena.mg` | Adresse expéditeur (Gmail impose celle du compte) |
| `MAIL_FROM_NAME` | non | `Tsena Marketplace` | Nom affiché |
| `MAIL_REPLY_TO` | non | — | Adresse de réponse (support) |
| `MAIL_DRIVER` | non | `smtp` si `MAIL_HOST`, sinon `log` | Forcer `log` pour couper les envois |
| `MAIL_SECURE` | non | `true` si port 465 | TLS implicite |
| `MAIL_REQUIRE_TLS` | non | `true` (sauf localhost / 465) | Refuse un relais sans STARTTLS |
| `MAIL_TLS_REJECT_UNAUTHORIZED` | non | `true` | Mettre `false` uniquement pour un relais interne auto-signé |
| `MAIL_TIMEOUT_MS` | non | `10000` | Délai connexion / salutation (socket = ×2) |
| `MAIL_POOL` | non | `false` | Connexions persistantes (fort volume) |
| `MAIL_VERIFY_ON_BOOT` | non | `true` | Teste la connexion au démarrage (non bloquant) |

### Premier administrateur (sans terminal : Render, Railway…)

Aucune variable d'environnement ni seed n'est nécessaire : sur une base vierge, le formulaire
`/inscription` propose le choix **« Administrateur »** et le **premier compte** créé avec ce choix reçoit
le rôle `admin` (statut actif, accès complet au tableau de bord). Dès qu'un administrateur existe — y
compris ceux du seed de développement — ce choix **disparaît de l'interface** et `POST /auth/register`
le refuse (`403`), en local comme en production. Les administrateurs suivants sont créés depuis l'espace
d'administration (`POST /admin/users` avec le rôle `admin`).

Ordre de démarrage sur une base Render vierge : au premier démarrage, l'API applique automatiquement les
migrations (`src/database/migrations/`) et crée les tables (zones de livraison et commissions par défaut
insérées au premier démarrage) → ouvrir le site →
s'inscrire en « Administrateur » → créer catégories et paramètres depuis le tableau de bord.
`ADMIN_SELF_REGISTRATION=false` ferme ce canal si l'on préfère provisionner l'admin autrement.

### Inscription : client, vendeur ou administrateur

`POST /api/auth/register` accepte `accountType` (`client` par défaut, `seller`, `admin`) ; le formulaire du
frontend propose les trois choix. Règles appliquées **côté serveur** quel que soit ce qu'envoie le client :

| `accountType` | Rôle attribué | Détail |
|---|---|---|
| `client` | `client` | Accès immédiat. |
| `seller` | `client` + `sellerRequestedAt` | Demande vendeur à approuver par un admin (`POST /admin/users/:id/approve-seller`) ; l'utilisateur achète en attendant. `requestSellerAccount: true` (ancien champ) est équivalent. |
| `admin` | `admin` | **Uniquement s'il n'existe encore aucun administrateur** (initialisation de la plateforme). Ensuite : `403` avec une erreur sur le champ `accountType`. Création sous transaction + verrou PostgreSQL (`pg_advisory_xact_lock`) : deux inscriptions simultanées ne peuvent pas obtenir le rôle toutes les deux. `ADMIN_SELF_REGISTRATION=false` ferme ce canal définitivement. |

`GET /api/auth/register/options` (public) renvoie `{ accountTypes, adminRegistrationOpen, adminRegistrationReason, sellerApprovalRequired }`
pour que le formulaire n'affiche le choix « Administrateur » que lorsqu'il est réellement disponible.

### E-mails (SMTP, nodemailer)

`MailService` (`src/modules/mail/`) est l'unique point d'envoi : vérification d'adresse, réinitialisation et
changement de mot de passe, alertes de sécurité, notifications transactionnelles (commandes, paiements, litiges,
messagerie, boutiques suivies). Transport **nodemailer/SMTP** configuré par les variables `MAIL_*`
(tableau dans « Configuration (.env) » ci-dessus ; exemples Gmail / Brevo / Mailpit dans `.env.example`). Sans `MAIL_HOST`, mode « log » : rien n'est envoyé, le contenu apparaît dans les logs (avertissement
au démarrage en production).

Garanties : un SMTP en panne ne fait jamais échouer un parcours métier (`send()` renvoie `false`, journalisé) ;
délais d'attente (10 s), une nouvelle tentative sur erreur réseau, version texte générée pour chaque message,
connexion testée au démarrage (`SMTP prêt` / `SMTP injoignable` dans les logs), état exposé par `GET /api/health`
(`mail: up | error | log`).

Diagnostic sans terminal (rôle admin) : `GET /api/admin/mail/status` (serveur, dernier succès / dernière erreur,
compteurs — jamais de secret), `POST /api/admin/mail/verify` (connexion + authentification), `POST /api/admin/mail/test`
(`{ "to": "vous@exemple.mg" }`, par défaut l'adresse de l'admin connecté) → `messageId` ou message d'erreur SMTP.

## Lancement

```bash
# Développement
npm run start:dev

# Build + Production
npm run build
npm run start:prod
```

## Migrations (schéma de la base)

Le schéma est géré par les migrations TypeORM (`src/database/migrations/`). **Elles s'exécutent
automatiquement à chaque démarrage de l'API** — dev comme prod, `start:dev`, `start:prod` ou image
Docker : une base vierge est créée, une base existante est mise à jour, sans commande manuelle
(`migrationsRun: true` dans `src/config/database.config.ts`). `DATABASE_SYNCHRONIZE` est donc `false`
par défaut.

```bash
npm run migration:generate -- src/database/migrations/NomDuChangement  # générer depuis les entités
npm run migration:run       # exécution manuelle (utile pour vérifier ; le démarrage le fait déjà)
npm run migration:revert    # annuler la dernière migration
```

## Qualité & CI

```bash
npm run lint        # ESLint 9 (flat config : eslint.config.mjs) — même commande que le job « Lint & Build »
npm run lint:fix    # corrections automatiques
npm run typecheck   # tsc --noEmit
npm test            # Jest (unitaires, sans base de données)
```

Le pipeline GitHub Actions (`.github/workflows/ci.yml`) enchaîne : `npm ci` → lint → typecheck → build → tests (couverture) → audit → image Docker (GHCR) sur `main`.

## Stockage des fichiers — S3-compatible, bucket unique

**Un seul bucket** (`MINIO_BUCKET`, `tsena` par défaut) contient tous les fichiers du projet ; le rangement se fait
par **préfixe de clé**, jamais par bucket :

| Préfixe de clé | Contenu | Origine |
|---|---|---|
| `products/<productId>/…` | images produit | `POST /api/upload/product/:id/image(s)` |
| `categories/<categoryId>/…` | vignettes de catégorie | `POST /api/upload/category/:id/image` |
| `avatars/<userId>/…` | photos de profil | `POST /api/upload/avatar` |
| `shops/logo/<shopId>/…`, `shops/cover/<shopId>/…` | logo et bannière de boutique | espace vendeur |
| `disputes/<disputeId>/…` | preuves de litige (images, PDF) | `POST /api/upload/dispute/:id/evidence` |
| `messages/<conversationId>/…` | pièces jointes de messages | messagerie |

- Le bucket doit exister avant le déploiement. Pour les URL durables actuelles du frontend, activer la **lecture
  publique des objets** dans la configuration du fournisseur ; l'API ne modifie pas les permissions du bucket.
  Cette politique rend publics tous les fichiers du bucket, y compris les preuves de litige et pièces jointes de
  messagerie (à confirmer comme choix de production).
- En production, définir `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` et
  `S3_BUCKET` (`assets` par défaut si un endpoint S3 est configuré), conformément aux variables du fournisseur S3-compatible. `S3_PUBLIC_URL` permet
  de préciser une base publique/CDN, sans le nom du bucket. Les identifiants doivent être des secrets d'environnement,
  jamais ajoutés au dépôt.
- URL renvoyée : `${S3_PUBLIC_URL}/<bucket>/<clé>` si `S3_PUBLIC_URL` est défini, sinon
  `${AWS_ENDPOINT_URL_S3}/<bucket>/<clé>`. La clé est extraite de l'URL pour les suppressions.
- En local, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`,
  `MINIO_REGION` et `MINIO_PUBLIC_URL` restent pris en charge lorsque `AWS_ENDPOINT_URL_S3` est vide.
  Les anciennes variables `MINIO_BUCKET_PRODUCTS/AVATARS/EVIDENCE`,
  `STORAGE_DRIVER` et `STORAGE_LOCAL_DIR` **n'existent plus** : il n'y a plus de stockage sur disque ni de service
  statique `/uploads`.

### Démarrer l'environnement complet

```bash
docker compose up -d          # PostgreSQL 17 + MinIO + création du bucket
npm run migration:run         # (ou simplement démarrer l'API : les migrations s'appliquent seules)
npm run start:dev
```

`docker-compose.yml` fournit `postgres` (5432), `minio` (API 9000, console 9001) et le service `minio-init` qui crée
le bucket et ouvre la lecture publique. L'image MinIO utilisée est **`pgsty/silo`**, fork communautaire maintenu de
MinIO : l'édition community officielle n'est plus publiée en binaire ni en image Docker depuis fin 2025 (dépôt
`minio/minio` archivé, images retirées de Docker Hub en septembre 2026). Le protocole S3 et les variables `MINIO_*`
sont compatibles avec le SDK AWS — seul le nom de l'image change, surchargeable par `MINIO_IMAGE`.

## Docker

```bash
docker build -t tsena-backend .
docker run --env-file .env --network tsena_default -p 3000:3000 tsena-backend
```

Image multi-stage (`node:20-bookworm-slim`, dépendances de production uniquement, utilisateur `node`), **sans volume
de fichiers** : tout passe par le stockage objet. La sonde `HEALTHCHECK` interroge `GET /api/health` (publique, hors rate
limiting) : `200 { status: "ok", database: "up" }` ou `503` si la base de données est injoignable. Variables à fournir
au conteneur : voir `.env.example` (`DATABASE_*`, `JWT_*`, `CORS_ORIGIN`, `APP_URL`, `AWS_*`, `S3_*` ou `MINIO_*`, `MAIL_*`).

## API Endpoints

### Auth (`/api/auth`)
| Méthode | Endpoint         | Description                    | Auth |
|---------|------------------|--------------------------------|------|
| POST    | /auth/register   | Inscription (accountType : client, seller, admin) | Non  |
| GET     | /auth/register/options | Types de compte disponibles (admin ouvert ?) | Non  |
| POST    | /auth/login      | Connexion                      | Non  |
| POST    | /auth/refresh    | Rafraîchir le token            | Non  |
| POST    | /auth/logout     | Déconnexion                    | Oui  |
| GET     | /auth/me         | Profil utilisateur connecté    | Oui  |

### Users (`/api/users`)
| Méthode | Endpoint         | Description                    | Rôle |
|---------|------------------|--------------------------------|------|
| GET     | /users           | Lister (paginé + filtres)      | ADMIN |
| GET     | /users/:id       | Détail utilisateur             | ADMIN |
| PATCH   | /users/:id       | Mettre à jour                  | ADMIN |
| DELETE  | /users/:id       | Supprimer (soft)               | ADMIN |

### Categories (`/api/categories`)
| Méthode | Endpoint         | Description                    | Rôle |
|---------|------------------|--------------------------------|------|
| POST    | /categories      | Créer une catégorie            | ADMIN |
| GET     | /categories      | Lister (paginé + filtres)      | Public |
| GET     | /categories/tree | Arborescence complète          | Public |
| GET     | /categories/:id  | Détail (ID ou slug)            | Public |
| PUT     | /categories/:id  | Mettre à jour                  | ADMIN |
| DELETE  | /categories/:id  | Supprimer                      | ADMIN |

### Products (`/api/products`)
| Méthode | Endpoint                      | Description              | Rôle |
|---------|-------------------------------|--------------------------|------|
| POST    | /products                     | Créer un produit         | SELLER/ADMIN |
| GET     | /products                     | Lister (filtres avancés) | Public |
| GET     | /products/featured            | Produits en vedette      | Public |
| GET     | /products/seller/stats        | Stats vendeur            | SELLER/ADMIN |
| GET     | /products/:id                 | Détail (ID ou slug)      | Public |
| PUT     | /products/:id                 | Mettre à jour            | Propriétaire |
| DELETE  | /products/:id                 | Supprimer (soft delete)  | Propriétaire |
| POST    | /products/:id/images          | Ajouter une image        | Propriétaire |
| DELETE  | /products/:id/images/:imageId | Supprimer une image      | Propriétaire |

### Upload (`/api/upload`)
| Méthode | Endpoint                          | Description              | Rôle |
|---------|-----------------------------------|--------------------------|------|
| POST    | /upload/product/:id/image         | Image produit            | SELLER/ADMIN |
| POST    | /upload/product/:id/images        | Images produit (×10)     | SELLER/ADMIN |
| POST    | /upload/category/:id/image        | Image catégorie          | ADMIN |
| POST    | /upload/avatar                    | Avatar utilisateur       | Authentifié |
| POST    | /upload/dispute/:id/evidence      | Preuve de litige         | Authentifié |
| DELETE  | /upload/:key                      | Supprimer fichier        | SELLER/ADMIN |

### Cart (`/api/cart`)
| Méthode | Endpoint              | Description                    | Rôle |
|---------|-----------------------|--------------------------------|------|
| GET     | /cart                 | Obtenir le panier complet      | Authentifié |
| GET     | /cart/count           | Nombre d'articles              | Authentifié |
| POST    | /cart/items           | Ajouter un article             | Authentifié |
| PATCH   | /cart/items/:id       | Modifier la quantité           | Authentifié |
| DELETE  | /cart/items/:id       | Supprimer un article           | Authentifié |
| DELETE  | /cart                 | Vider le panier                | Authentifié |

### Orders (`/api/orders`)
| Méthode | Endpoint                | Description                  | Rôle |
|---------|-------------------------|------------------------------|------|
| POST    | /orders                 | Créer commande (depuis panier) | Authentifié |
| GET     | /orders                 | Lister mes commandes         | Authentifié |
| GET     | /orders/seller/stats    | Stats commandes vendeur      | SELLER/ADMIN |
| GET     | /orders/buyer/stats     | Stats commandes acheteur     | CLIENT/BUYER |
| GET     | /orders/number/:num     | Par numéro de commande       | Authentifié |
| GET     | /orders/:id             | Détail commande              | Propriétaire |
| PATCH   | /orders/:id/status      | Mettre à jour statut         | Propriétaire |

### Payments (`/api/payments`)
| Méthode | Endpoint                      | Description            | Rôle |
|---------|-------------------------------|------------------------|------|
| POST    | /payments/initiate            | Initier un paiement    | CLIENT/BUYER |
| POST    | /payments/callback            | Webhook provider       | Public |
| POST    | /payments/:id/simulate-success| Simuler succès         | ADMIN |
| POST    | /payments/:id/confirm         | Confirmer manuellement | ADMIN |
| GET     | /payments/stats               | Statistiques paiements | ADMIN |
| GET     | /payments/order/:orderId      | Paiements d'une commande | Authentifié |
| GET     | /payments/transaction/:txnId  | Par ID transaction     | Authentifié |
| GET     | /payments/:id                 | Détail paiement        | Authentifié |
| GET     | /payments                     | Lister (admin)         | ADMIN |

### Escrow (`/api/escrow`)
| Méthode | Endpoint                | Description                    | Rôle |
|---------|-------------------------|--------------------------------|------|
| GET     | /escrow/order/:orderId  | Séquestre d'une commande       | Authentifié |
| GET     | /escrow/payment/:id     | Séquestre d'un paiement        | ADMIN |
| GET     | /escrow/stats           | Statistiques escrow            | ADMIN |
| GET     | /escrow/:id             | Détail séquestre               | Authentifié |
| POST    | /escrow/:id/release     | Libérer fonds → vendeur        | CLIENT/ADMIN |
| POST    | /escrow/:id/block       | Bloquer fonds (litige)         | ADMIN |
| POST    | /escrow/:id/unblock     | Débloquer après litige         | ADMIN |
| POST    | /escrow/:id/refund      | Rembourser l'acheteur          | ADMIN |

### Disputes (`/api/disputes`)
| Méthode | Endpoint                | Description                    | Rôle |
|---------|-------------------------|--------------------------------|------|
| POST    | /disputes               | Créer un litige                | Authentifié |
| POST    | /disputes/:id/evidence  | Ajouter une preuve             | Authentifié |
| POST    | /disputes/:id/resolve   | Résoudre (admin)               | ADMIN |
| GET     | /disputes/stats         | Statistiques litiges           | ADMIN |
| GET     | /disputes/:id           | Détail litige                  | Authentifié |
| GET     | /disputes/:id/evidence  | Preuves du litige              | Authentifié |
| GET     | /disputes               | Lister litiges                 | Authentifié |

### Reviews (`/api/reviews`)
| Méthode | Endpoint                      | Description              | Rôle |
|---------|-------------------------------|--------------------------|------|
| POST    | /reviews                      | Créer un avis            | CLIENT/BUYER |
| PATCH   | /reviews/:id                  | Modifier un avis (24h)   | Auteur/ADMIN |
| DELETE  | /reviews/:id                  | Masquer un avis          | Auteur/ADMIN |
| GET     | /reviews/stats                | Statistiques avis        | ADMIN |
| GET     | /reviews/user/:id/average     | Note moyenne utilisateur | Public |
| GET     | /reviews/:id                  | Détail avis              | Public |
| GET     | /reviews                      | Lister avis              | Public |

### Badges (`/api/badges`)
| Méthode | Endpoint                           | Description           | Rôle |
|---------|------------------------------------|-----------------------|------|
| POST    | /badges                            | Créer un badge        | ADMIN |
| PUT     | /badges/:id                        | Modifier un badge     | ADMIN |
| DELETE  | /badges/:id                        | Supprimer un badge    | ADMIN |
| POST    | /badges/award                      | Attribuer un badge    | ADMIN |
| DELETE  | /badges/award/:userId/:badgeId     | Retirer un badge      | ADMIN |
| GET     | /badges/user/:userId               | Badges d'un utilisateur | Public |
| GET     | /badges/stats                      | Statistiques badges   | ADMIN |
| GET     | /badges/:id                        | Détail badge          | Public |
| GET     | /badges                            | Lister badges         | Public |

### Admin (`/api/admin`)
| Méthode | Endpoint                      | Description                  | Rôle |
|---------|-------------------------------|------------------------------|------|
| GET     | /admin/dashboard              | Tableau de bord global       | ADMIN |
| POST    | /admin/users/:id/suspend      | Suspendre un utilisateur     | ADMIN |
| POST    | /admin/users/:id/activate     | Activer un utilisateur       | ADMIN |
| POST    | /admin/users/:id/approve-seller | Approuver un vendeur       | ADMIN |
| POST    | /admin/products/:id/approve   | Approuver un produit         | ADMIN |
| POST    | /admin/products/:id/reject    | Rejeter un produit           | ADMIN |
| GET     | /admin/audit-logs             | Logs d'audit                 | ADMIN |
| GET     | /admin/mail/status            | État du transport e-mail (SMTP) | ADMIN |
| POST    | /admin/mail/verify            | Tester la connexion SMTP     | ADMIN |
| POST    | /admin/mail/test              | Envoyer un e-mail de test `{ to? }` | ADMIN |

### Filtres Produits (GET /api/products)
| Param       | Type    | Description                       |
|-------------|---------|-----------------------------------|
| search      | string  | Recherche nom/description         |
| categoryId  | uuid    | Filtrer par catégorie             |
| minPrice    | number  | Prix minimum                      |
| maxPrice    | number  | Prix maximum                      |
| status      | enum    | draft, active, published, archived |
| sellerId    | uuid    | Filtrer par vendeur               |
| isFeatured  | boolean | En vedette uniquement             |
| inStock     | boolean | En stock uniquement               |
| tags        | string  | Tags (séparés par virgule)        |
| sortBy      | string  | name, price, createdAt, stockQuantity |
| order       | string  | ASC, DESC                         |
| page        | number  | Page courante                     |
| limit       | number  | Nombre par page (max 100)         |

## Architecture

```
src/
├── main.ts                     # Bootstrap, validation, Swagger
├── app.module.ts               # Module racine
├── config/
│   └── database.config.ts      # Configuration TypeORM
├── database/
│   └── entities/               # 16 entités TypeORM
│       ├── user.entity.ts      # User, Profile, Address
│       ├── catalog.entity.ts   # Category, Product, ProductImage
│       ├── transaction.entity.ts # 13 entités transactionnelles
│       └── role.enum.ts        # Tous les enums
├── common/                     # Infrastructure partagée
│   ├── decorators/             # @Roles, @CurrentUser
│   ├── guards/                 # RolesGuard (RBAC)
│   ├── filters/                # GlobalExceptionFilter
│   ├── interceptors/           # Transform, Logging
│   ├── dto/                    # PaginationDto
│   └── utils/                  # ApiResponse helpers
└── modules/
    ├── auth/                   # JWT auth (register, login, refresh, logout)
    ├── users/                  # CRUD utilisateurs (admin)
    ├── categories/             # CRUD catégories + arborescence
    ├── products/               # CRUD produits + filtres avancés
    ├── upload/                 # Upload fichiers via MinIO
    ├── cart/                   # Panier utilisateur
    ├── orders/                 # Commandes (création, statuts, stats)
    ├── payments/               # Paiements (initiation, callback, escrow auto)
    ├── escrow/                 # Séquestre (release, block, refund)
    ├── disputes/               # Litiges (preuves, résolution, escrow lié)
    ├── reviews/                # Avis et notes (1-5 étoiles, modération)
    ├── badges/                 # Badges (attribution, récompenses)
    └── admin/                  # Dashboard admin (stats, audit, modération)
```

## Format de Réponse Standard

Toutes les réponses API suivent ce format :

```json
{
  "success": true,
  "message": "Description en français",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

## Rôles & Permissions

| Rôle     | Description                          |
|----------|--------------------------------------|
| CLIENT   | Client standard (achat)              |
| BUYER    | Acheteur                             |
| SELLER   | Vendeur (gestion catalogue)          |
| ADMIN    | Administrateur (accès total)         |

## Entités (19)

**Auth/Users :** User, Profile, Address
**Catalogue :** Category, Product, ProductImage
**Transactions :** Cart, CartItem, Order, OrderLine, Payment, Escrow, Delivery, Dispute, DisputeEvidence, Review, Badge, UserBadge, AuditLog

## Roadmap

- [x] **Phase 1** : Auth + Users + RBAC + JWT
- [x] **Phase 2** : Products + Categories + MinIO upload
- [x] **Phase 3** : Cart + Orders + Payments + Escrow
- [x] **Phase 4** : Disputes + Reviews + Badges + Admin
- [x] **Phase 5** : Frontend TanStack Query + service layer (`tsena-virtuel/src/api`, `src/hooks`)
- [x] **Phase 6** : Frontend refactoring (zéro mock, états chargement/erreur/vide, ConfirmDialog, ErrorBoundary typé)
- [x] **Phase 7** : Tests (backend Jest 59 tests · frontend Vitest 54 tests) + audit (`SECURITY_AUDIT.md`)

## Intégration frontend

- Le frontend consomme l'API via `VITE_API_URL=http://localhost:3000/api` ; la matrice complète des routes est dans `tsena-virtuel/docs/ROUTES_MATRIX.md`.
- Enveloppe de réponse unique : `{ success, message, data, meta? }` / `{ success:false, message, errors?[{field,message}] }`.
- Les listes de produits renvoient un résumé public du vendeur (`seller: { id, firstName, lastName, avatarUrl, reputationScore, memberSince }`), les commandes des résumés acheteur/vendeur (`buyer`, `seller`) et des lignes enrichies (`lines[]`).
- `DELETE /products/:id` et `DELETE /categories/:id` sont des suppressions logiques (`deletedAt`).

## Swagger

Documentation interactive disponible sur `/docs` en développement.

```bash
npm run start:dev
# Ouvrir http://localhost:3000/docs
```

## Licence

Propriétaire — Tsena Marketplace
