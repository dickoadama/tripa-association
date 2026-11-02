# TRIPA

Plateforme de gestion d'association — **100 % statique** (HTML / CSS / JavaScript), sans backend ni base de données. Les données sont stockées dans le `localStorage` du navigateur. Déployable telle quelle sur **GitHub Pages**.

> ⚠️ Sans serveur, l'authentification est **symbolique** : les données restent locales à chaque navigateur et ne sont **pas** synchronisées entre utilisateurs. Ne stockez aucune information confidentielle.

## Sommaire
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Entités gérées](#entités-gérées)
- [Rôles et comptes](#rôles-et-comptes)
- [Installation et prévisualisation](#installation-et-prévisualisation)
- [Déploiement sur GitHub Pages](#déploiement-sur-github-pages)
- [Limites connues](#limites-connues)

## Fonctionnalités
- Tableau de bord avec compteurs et accès rapides.
- Gestion CRUD complète de 8 entités via un moteur générique.
- Console Super Admin : validation / rejet / suspension des comptes admin, mot de passe temporaire.
- Réglages : profil et changement de mot de passe.
- Design clair et minimaliste, **sans animation d'entrée** (affichage instantané, vue stable).

## Architecture
```
tripa/
├── index.html            Connexion
├── register.html         Inscription (soumis à validation)
├── dashboard.html        Tableau de bord
├── entity.html           Écran générique (toutes les entités)
├── admin-management.html Console Super Admin
├── settings.html         Réglages
├── css/app.css           Design system (tokens + composants)
└── js/
    ├── api.js            Couche de données localStorage + auth + CRUD
    ├── utils.js          UI kit, navigation, registre ENTITY_SCHEMA
    ├── auth.js           Login / register
    ├── entity.js         Moteur CRUD générique piloté par ?t=<entité>
    ├── admin-management.js  Console Super Admin
    └── settings.js       Profil + mot de passe
```
**Point d'extension unique :** toute la persistance est isolée dans `js/api.js`. Les modules ne font que consommer des fonctions asynchrones renvoyant `{ data, error }`.

## Entités gérées
`adherents`, `cotisations`, `evenements`, `activites`, `communications`, `achats`, `documents`, `taches`.

Chaque entité est déclarée dans `ENTITY_SCHEMA` (`js/utils.js`) : la page `entity.html?t=<entité>` construit automatiquement liste, recherche, formulaire modal et actions. Ajouter une entité = ajouter une entrée dans le schéma + une entrée dans `NAV`.

## Rôles et comptes
- **Super Admin** : `superadmin@tripa.com`, mot de passe par défaut `tripa-super-2026` (à changer dans Réglages). Voit et gère tous les comptes.
- **Admin** : crée son compte via `register.html` → statut `pending` → validé par le Super Admin. Ses données sont cloisonnées par `admin_id`.

## Installation et prévisualisation
Aucune dépendance. Ouvrez simplement les fichiers, ou lancez un serveur local :
```powershell
cd e:\PROTECT\PROJET\HTML\tripa
python -m http.server 8000
```
Puis : `http://localhost:8000`

## Déploiement sur GitHub Pages
1. Poussez le dépôt sur la branche `main`.
2. GitHub → **Settings → Pages** → Source : `Deploy from a branch`, branche `main`, dossier `/ (root)` → **Save**.
3. L'URL de production apparaît après ~1 minute.

## Limites connues
- Données locales au navigateur, non partagées entre utilisateurs ni appareils.
- Authentification non sécurisée (hachage symbolique côté client).
- `documents` : métadonnées uniquement (nom, catégorie, taille, lien) — pas de téléversement de fichier réel.
