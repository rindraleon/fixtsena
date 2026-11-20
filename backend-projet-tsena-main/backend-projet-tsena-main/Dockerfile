# ============================================
# TSENA Backend — image de production (multi-stage)
# ============================================
# build : installe toutes les dépendances, compile NestJS (dist/)
# runtime : image allégée, dépendances de production uniquement, utilisateur non root
#
#   docker build -t tsena-backend .
#   docker run --env-file .env -p 3000:3000 tsena-backend
#
# Les fichiers sont stockés dans MinIO (bucket unique) : aucun volume à monter.

ARG NODE_VERSION=20

# ─── Étape 1 : build ─────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV CI=true

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ─── Étape 2 : dépendances de production ────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
ENV CI=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ─── Étape 3 : runtime ───────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    MINIO_ENDPOINT=minio \
    MINIO_PORT=9000 \
    MINIO_USE_SSL=false \
    MINIO_BUCKET=tsena

# Dépendances prod + build compilé (propriété de l'utilisateur `node` fourni par l'image)
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

# Sonde de santé : GET /api/health (publique) répond 200 quand l'API et la base sont joignables
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/' + (process.env.API_PREFIX || 'api') + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
