# TRIPA

Plateforme de gestion d'association — **application client-serveur** (frontend HTML/CSS/JS vanilla + backend **Node/Express** + base **Turso/libSQL**). Sessions par **cookie httpOnly + JWT**, mots de passe **hachés (bcryptjs)**, données cloisonnées par association.

Le frontend est **100 % autonome** : aucune dépendance externe (icônes et graphiques sont auto-hébergés, police système). Il peut donc tourner entièrement hors-ligne une fois servi.

## Sommaire
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Environnement et variables](#environnement-et-variables)
- [Démarrage local (sans Docker)](#démarrage-local-sans-docker)
- [Auto-hébergement avec Docker](#auto-hébergement-avec-docker)
- [HTTPS/TLS en une commande (Caddy)](#httpstls-en-une-commande-caddy)
- [Reverse proxy & HTTPS](#reverse-proxy--https)
- [Déploiement managé (Render)](#déploiement-managé-render)
- [Rôles et comptes](#rôles-et-comptes)
- [Maintenance](#maintenance)

## Fonctionnalités
- **Tableau de bord** : compteurs agrégés (`/api/stats`) et graphiques (donut/barres, moteur local).
- **8 entités** gérées par un moteur CRUD générique (`entity.html?t=<entité>`) : adhérents, cotisations, événements, activités, communications, achats, documents, tâches.
- **Console Super Admin** : validation / rejet / suspension des comptes, mot de passe temporaire.
- **Journal d'activité** : frise des créations/modifications/suppressions.
- **Réglages** en onglets : profil, apparence (thème **clair/sombre/auto**, accent, densité), notifications, données (export/restauration), sécurité.
- **Pages Profil & Aide**, **export PDF/impression**, **PWA** (coquille hors-ligne), **recherche globale** (Ctrl+K).

## Architecture
```
tripa/
├── public/            Frontend (source de développement)
│   ├── *.html         Pages (index, register, dashboard, entity, admin-management,
│   │                  settings, profile, help, activity)
│   ├── css/app.css    Design system (thème, densité, composants, effets sobres)
│   ├── js/            Modules : api, utils, prefs, auth, entity, admin-management,
│   │                  settings, profile, help, activity, pwa,
│   │                  lucide (icônes locales), chart (graphiques locaux)
│   ├── sw.js          Service Worker (coquille hors-ligne)
│   └── manifest.webmanifest
├── server/            Backend Express (API REST + sert le build)
│   ├── server.js      Routes, authentification, CRUD générique, stats, journal
│   ├── db.js          Accès Turso / SQLite local + création des tables
│   ├── auth.js        JWT + cookie + bcrypt + middlewares
│   └── schema.js      Registre des entités (colonnes/types côté serveur)
├── build.js           Minification public/ → dist/ (terser + clean-css)
├── Dockerfile         Image d'auto-hébergement
├── docker-compose.yml Stack prête à l'emploi (base SQLite persistée)
└── render.yaml        Blueprint Render
```
**Point d'entrée unique** : `server/server.js`. Il sert `dist/` s'il existe (build minifié), sinon `public/` (dev). Toute la persistance et les secrets restent côté serveur.

## Environnement et variables
Le serveur lit son environnement via `dotenv` (depuis `server/.env` en mode nu, ou via l'environnement du conteneur).

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port écouté | `10000` |
| `JWT_SECRET` | Signature des jetons (longue chaîne aléatoire) | généré aléatoirement (sessions invalidées au redémarrage) |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Compte Super Admin créé au 1er lancement | `superadmin@tripa.com` / `tripa-super-2026` |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Base Turso. **Vide ⇒ SQLite locale** `server/data/tripa.db` | vide |
| `COOKIE_SECURE` | `true` derrière HTTPS, `false` en HTTP simple | `true` si `NODE_ENV=production`, sinon `false` |
| `NODE_ENV` | `production` active le cache-d'abord du build | — |

Exemples fournis : `.env.example` (racine, pour Docker) et `server/.env.example` (mode nu).

## Démarrage local (sans Docker)
```powershell
# 1) Dépendances
npm install
npm --prefix server install

# 2) (Optionnel) copier l'exemple d'environnement
#    server\.env.example -> server\.env et ajuster JWT_SECRET etc.

# 3) Lancer (base SQLite locale créée automatiquement)
npm start
```
Puis ouvrir `http://localhost:10000`. Pour générer le build minifié : `npm run build` (le serveur sert alors `dist/`).

## Auto-hébergement avec Docker
La façon la plus simple de déployer TRIPA chez vous, **sans aucun service externe** (base SQLite persistée dans un volume).

```bash
# 1) Copier et personnaliser l'environnement
cp .env.example .env
#   → renseignez au minimum JWT_SECRET et SUPER_ADMIN_PASSWORD
#   → openssl rand -hex 32 pour un secret robuste

# 2) Construire et démarrer
docker compose up -d --build

# 3) Ouvrir
#   http://localhost:10000
```

Commandes utiles :
```bash
docker compose logs -f tripa      # suivre les journaux
docker compose restart            # redémarrer
docker compose down               # arrêter (les données restent dans le volume)
docker volume ls                  # volume « tripa_data » = base SQLite
```

Les **données survivent** aux redémarrages (volume `tripa-data` monté sur `/app/server/data`). Pour utiliser **Turso** à la place, renseignez `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN` dans `.env`.

## HTTPS/TLS en une commande (Caddy)
`docker-compose.https.yml` ajoute **Caddy** comme reverse proxy devant TRIPA : **TLS automatique** (Let's Encrypt en production, certificat interne pour `localhost`), HTTP→HTTPS, en-têtes de sécurité. TRIPA **n'expose aucun port public** (seuls 80/443 de Caddy sortent), et le cookie passe en `COOKIE_SECURE=true`.

```bash
cp .env.example .env
#   → renseignez JWT_SECRET et DOMAIN
#     DOMAIN=tripa.mondomaine.com  (public, ports 80/443 ouverts → Let's Encrypt)
#     DOMAIN=localhost             (test local en HTTPS, certificat self-signed)

docker compose -f docker-compose.https.yml up -d --build
```
Puis `https://<DOMAIN>`. Les certificats et la config Caddy sont persistés dans les volumes `caddy-data` / `caddy-config`. Le fichier `Caddyfile` fourni est à adapter si vous avez des besoins avancés (multiple domaines, wildcards, DNS challenge…).

> **DNS challenge (option)** : si TRIPA n'est pas joignable sur le port 80 (derrière un NAT), remplacez le bloc site du `Caddyfile` par `{$DOMAIN} { tls { dns cloudflare {env.CLOUDFLARE_API_TOKEN} } reverse_proxy tripa:10000 }` et exposez ce jeton à Caddy.

## Reverse proxy & HTTPS
En production exposée sur Internet, placez TRIPA derrière un reverse proxy TLS (Caddy, Nginx, Traefik) et passez `COOKIE_SECURE=true`.

Exemple **Caddy** :
```
tripa.example.com {
    reverse_proxy 127.0.0.1:10000
}
```
Le serveur est déjà configuré avec `trust proxy` (IP cliente et protocole correctement détectés). Variables d'environnement correspondantes :
```
NODE_ENV=production
COOKIE_SECURE=true
JWT_SECRET=<secret long et aléatoire>
```

## Déploiement managé (Render)
Le dépôt contient `Dockerfile` et `render.yaml`. Sur Render : créez un service **Docker** à partir du dépôt, puis définissez dans le tableau de bord `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SUPER_ADMIN_PASSWORD` (le plan gratuit sert l'URL `/` comme sonde de santé ; `/api/health` est aussi disponible).

## Rôles et comptes
- **Super Admin** — `superadmin@tripa.com`, mot de passe par défaut `tripa-super-2026` (**à changer** dans Réglages). Voit et gère toutes les associations.
- **Admin** — s'inscrit via `register.html`, statut `pending`, puis validé par le Super Admin. Ses données sont isolées par `admin_id`.

## Maintenance
- **Sauvegarde** : exportez depuis Réglages → Données (JSON via `/api/backup/all`), ou copiez le fichier `server/data/tripa.db` / le volume Docker.
- **Mise à jour** : `git pull` puis `docker compose up -d --build` (ou `npm run build && npm start`).
- **Sonde de santé** : `GET /api/health` renvoie `{ status, version, webRoot, time }`.
