# TRIPA

Plateforme de gestion d'association — **frontend 100 % statique** (HTML/CSS/JS vanilla, aucune dépendance externe, aucune construction) connecté à **Supabase** pour l'authentification et le stockage des données partagées. Les appels passent par les **endpoints REST directs** de Supabase (`fetch` pur — aucun SDK, aucun CDN).

Le frontend est **entièrement autonome** : icônes et graphiques sont auto-hébergés (`js/lucide.js`, `js/chart.js`), police système. Installable en **PWA** ; l'interface reste ouverte hors-ligne, la synchronisation des données requiert une connexion.

## Comptes & rôles
| Rôle | Qui | Droits |
|---|---|---|
| **Super Admin** | Unique — forcé côté serveur (trigger SQL) sur le **premier inscrit** | Console de gestion : crée les admins par lien d'invitation, suspend/révoque les comptes. Ne touche aucune donnée métier. |
| **Admin** | Invité par le Super Admin (lien `register.html?invite=<token>`) | CRUD complet de ses données (`owner_id = auth.uid()`), invite ses utilisateurs. |
| **User** | Invité par un admin | Lecture des données de son admin (Tableau de bord, Événements, Activités, Annonces, Tâches) ; seule modification : le **statut des tâches**. |

Cloisonnement garanti par les **politiques RLS** PostgreSQL (`supabase-schema.sql`) : chaque ligne porte un `owner_id` assigné par trigger, et le rôle d'un compte est impossible à falsifier depuis le client. Les inscriptions sans invitation valide échouent côté serveur (`TRIPA_NO_INVITATION`).

## Fonctionnalités
- **Tableau de bord** : compteurs agrégés et graphiques (donut/barres, moteur local) ; section Invitations côté admin.
- **8 entités** gérées par un moteur CRUD générique (`entity.html?t=<entité>`) : adhérents, cotisations, événements, activités, communications, achats, documents, tâches.
- **Console Super Admin** (`admin-management.html`) : création d'admins par lien copiable/mailto, suspension, réactivation, révocation, vue des utilisateurs rattachés.
- **Journal d'activité** partagé (table `activity`, alimenté à chaque écriture).
- **Réglages** en onglets : profil, apparence (thème, accent, densité), notifications, données (export/restauration JSON), mot de passe.
- **Pages Profil & Aide**, **recherche globale** (Ctrl+K), **export/import CSV**, **export PDF/impression**.

## Architecture
```
tripa/
├── *.html             Pages (index, register, dashboard, entity, admin-management,
│                      settings, profile, help, activity)
├── supabase-schema.sql Schéma SQL complet (tables, triggers, RLS) — à exécuter dans
│                      l'éditeur SQL du dashboard Supabase (project ldfjbjwtqcikcfsjotgt)
├── css/app.css        Design system (thème, densité, composants, effets sobres)
├── js/
│   ├── api.js         Couche Supabase : client REST/Auth (fetch pur), session JWT,
│   │                  CRUD générique (cols jsonb), invitations, guards de rôle
│   ├── utils.js       Layout, navigation par rôle (navFor), recherche globale, toasts
│   ├── prefs.js       Préférences locales (thème, accent, densité, notifications)
│   ├── auth.js        Connexion / inscription via lien d'invitation / Super Admin
│   ├── admin-management.js  Console Super Admin
│   ├── entity.js      Moteur CRUD générique + analyses (lecture seule côté user)
│   ├── chart.js       Graphiques canvas auto-hébergés
│   ├── lucide.js      Icônes SVG auto-hébergées
│   ├── settings.js · profile.js · help.js · activity.js   Pages applicatives
│   └── pwa.js         Enregistrement du Service Worker
├── sw.js              Service Worker (coquille hors-ligne, cache tripa-v16)
├── manifest.webmanifest
└── icons/             Icônes PWA (SVG, maskable inclus)
```

### Clés localStorage
| Clé | Contenu |
|---|---|
| `tripa_session` | Session Supabase (`access_token`, `refresh_token`, user) |
| `tripa_profile_cache` | Cache du profil courant (rôles, coordonnées) |
| `tripa_prefs` | Préférences d'interface (seules données locales conservées) |

Les anciennes clés de l'architecture « 100 % local » (`tripa_key`, `tripa_unlocked`, `tripa_profile`, `tripa_activity`, `tripa_data_*`) sont **purgées automatiquement** au chargement de `js/api.js`.

### Prérequis Supabase
1. Exécuter `supabase-schema.sql` en entier dans l'éditeur SQL du dashboard (DROP + recréation : remise à zéro des données cloud).
2. **Authentication → Sign In → « Confirm email » désactivé** (inscription via lien instantanée).
3. La **clé anon (publishable)** du projet `ldfjbjwtqcikcfsjotgt` est déjà renseignée dans `js/api.js` (`SUPABASE_ANON_KEY`) — clé publique par conception, protégée par RLS ; à remplacer uniquement en cas de changement de projet.

## Utilisation locale
Servir le dossier avec n'importe quel serveur statique :
```powershell
npm run serve   # http://localhost:10007 (http-server, anti-cache activé)
```
Premier lancement : `index.html` propose « Créer le compte Super Admin » (visible tant qu'aucun profil n'existe). Ensuite : connexion email + mot de passe, inscription uniquement par lien d'invitation. Oubli de mot de passe : « Mot de passe oublié ? » (endpoint `/auth/v1/recover`).

## Publication
GitHub Pages est alimenté par le workflow **Deploy GitHub Pages** (`.github/workflows/deploy-pages.yml`) : à chaque poussée sur `main`, `npm run build` est exécuté et **seul `dist/` est publié**. Le code publié est minifié (variables internes renommées, commentaires retirés — y compris les scripts inline), et un script garde-fou bloque clic droit / F12 / Ctrl+U dans les pages servies.

En local : `npm run build` produit le même `dist/` ; la racine reste en source lisible pour le développement.

> Note : sur un site 100 % statique, le code reste téléchargeable par nature — ces mesures rendent la lecture fastidieuse (dissuasion), pas impossible. Le dépôt Git lui-même contient la source lisible : ne le rendez public que si vous l'acceptez.

Après toute modification d'assets, **incrémenter la version du cache** dans `sw.js` (`tripa-vN`) pour forcer l'invalidation chez les utilisateurs ; les entrées `SHELL` du pré-cache doivent exister (`addAll` échoue atomiquement sinon) et `build.js` (`FRONTEND_ITEMS`) doit connaître les nouvelles pages.

## Sauvegarde des données
Réglages → Données : export **JSON** complet (toutes les entités du compte) et restauration (remplace les données actuelles du compte). Export CSV par entité depuis chaque tableau. Les données vivent sur Supabase : survit à un changement d'appareil, mais l'export JSON périodique reste recommandé.

## Maintenir la cohérence
- `js/utils.js` expose `ENTITY_SCHEMA` — source unique des champs pour formulaires, tableaux, stats, exports ; `js/api.js` le consomme (`fieldsOf`).
- Les tables d'entités sont génériques (`cols jsonb`) : un nouveau champ ne demande aucune migration SQL.
- Toute modification de rôle/RLS se fait dans `supabase-schema.sql` ; les textes d'aide doivent décrire l'architecture **Supabase multi-rôles** : toute mention de « 100 % local », code d'accès local ou SHA-256 est une anomalie à corriger.
