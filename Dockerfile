# TRIPA — Image Docker (auto-hébergement, Render, Railway, Fly.io…)
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# 1) Dépendances de BUILD racine (terser + clean-css = devDependencies)
#    --include=dev est indispensable : NODE_ENV=production sinon, elles seraient ignorées.
COPY package*.json ./
RUN npm install --include=dev

# 2) Dépendances RUNTIME du serveur (express, libsql, bcryptjs, jsonwebtoken…)
COPY server/package*.json ./server/
RUN npm install --prefix server --omit=dev

# 3) Code source + build du frontend (minification -> dist/)
COPY . .
RUN npm run build

# 4) Dossiers base SQLite + sauvegardes (auto-hébergement) + utilisateur non-root.
#    Pré-créer /app/backups avec le bon propriétaire : un volume Docker nommé, monté
#    vide, hérite des droits de ce répertoire de l'image (sinon l'user node ne peut écrire).
RUN mkdir -p /app/server/data /app/backups /app/offsite \
 && addgroup -S node && adduser -S node -G node \
 && chown -R node:node /app
USER node

EXPOSE 10000
VOLUME ["/app/server/data"]

# Sonde de santé (busybox wget est présent dans l'image alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-10000}/api/health" >/dev/null || exit 1

CMD ["node", "server/server.js"]
