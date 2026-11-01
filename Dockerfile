# TRIPA — image Docker pour Fly.io
# Node 22 : contient le module natif node:sqlite (aucune compilation requise)
FROM node:22-slim

WORKDIR /app

# Dépendances d'abord (meilleure mise en cache)
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Code de l'application (frontend + backend)
COPY . .

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/tripa.db

EXPOSE 8080

CMD ["node", "server/server.js"]
