# TRIPA — image Docker pour Render (ou tout hébergeur Docker)
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# 1) Dépendances racine (build: terser + clean-css)
COPY package*.json ./
RUN npm install

# 2) Dépendances serveur (express, libsql, bcrypt, jwt...)
COPY server/package*.json ./server/
RUN npm install --prefix server --omit=dev

# 3) Code source
COPY . .

# 4) Build frontend (minification -> dist/)
RUN npm run build

EXPOSE 10000
CMD ["node", "server/server.js"]
