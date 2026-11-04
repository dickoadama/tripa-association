# TRIPA

Plateforme de gestion d'association — **application 100 % statique** (HTML/CSS/JS vanilla, aucune dépendance externe, aucune construction). Toutes les données vivent dans le **localStorage du navigateur** : aucun serveur, aucun compte en ligne, aucun appel réseau.

Le frontend est **entièrement autonome** : icônes et graphiques sont auto-hébergés (`js/lucide.js`, `js/chart.js`), police système. Installable en **PWA** et pleinement fonctionnel **hors-ligne**.

## Fonctionnalités
- **Tableau de bord** : compteurs agrégés et graphiques (donut/barres, moteur local).
- **8 entités** gérées par un moteur CRUD générique (`entity.html?t=<entité>`) : adhérents, cotisations, événements, activités, communications, achats, documents, tâches.
- **Journal d'activité** : frise des créations/modifications/suppressions.
- **Réglages** en onglets : profil, apparence (thème clair/sombre/auto, accent, densité), notifications, données (export/restauration JSON), sécurité.
- **Pages Profil & Aide**, **recherche globale** (Ctrl+K), **export/import CSV**, **export PDF/impression**.

## Architecture
```
tripa/
├── *.html             Pages (index, register, dashboard, entity, settings,
│                      profile, help, activity)
├── css/app.css        Design system (thème, densité, composants, effets sobres)
├── js/
│   ├── api.js         Couche de données localStorage (CRUD générique, auth,
│   │                  sauvegarde/restauration) — signatures asynchrones
│   ├── utils.js       Layout, navigation, recherche globale, toasts, helpers
│   ├── prefs.js       Préférences (thème, accent, densité, notifications)
│   ├── auth.js        Code d'accès local (écran connexion/inscription)
│   ├── entity.js      Moteur CRUD générique + analyses
│   ├── chart.js       Graphiques canvas auto-hébergés
│   ├── lucide.js      Icônes SVG auto-hébergées
│   ├── settings.js · profile.js · help.js · activity.js   Pages applicatives
│   └── pwa.js         Enregistrement du Service Worker
├── sw.js              Service Worker (coquille hors-ligne, cache tripa-v13)
├── manifest.webmanifest
└── icons/             Icônes PWA (SVG, maskable inclus)
```

### Clés localStorage
| Clé | Contenu |
|---|---|
| `tripa_data_<entité>` | Lignes de l'entité (`[{ id, …champs, created_at, updated_at }]`) |
| `tripa_activity` | Journal d'activité |
| `tripa_profile` | Profil de l'administrateur local |
| `tripa_key` | Empreinte **SHA-256** du code d'accès (jamais le code en clair) |
| `tripa_unlocked` | Marqueur de session déverrouillée |

**Accès** : au premier lancement (base vide), `index.html` redirige vers `register.html` pour définir le code d'accès et le profil ; les ouvertures suivantes demandent ce code. Oubli du code : `localStorage.removeItem('tripa_key')` dans la console du navigateur, puis définir un nouveau code — les données restent intactes.

## Utilisation locale
Aucun serveur ni Node n'est requis : ouvrir `index.html` dans le navigateur, ou servir le dossier avec n'importe quel serveur statique :
```powershell
npm run serve   # http://localhost:10007 (http-server, anti-cache activé)
```

## Publication
GitHub Pages est alimenté par le workflow **Deploy GitHub Pages** (`.github/workflows/deploy-pages.yml`) : à chaque poussée sur `main`, `npm run build` est exécuté et **seul `dist/` est publié**. Le code publié est minifié, les variables internes renommées, les commentaires retirés, et un script garde-fou bloque clic droit / F12 / Ctrl+U dans les pages servies.

En local : `npm run build` produit le même `dist/` ; la racine reste en source lisible pour le développement.

> Note : sur un site 100 % statique, le code reste téléchargeable par nature — ces mesures rendent la lecture fastidieuse (dissuasion), pas impossible. Le dépôt Git lui-même contient la source lisible : ne le rendez public que si vous l'acceptez.

Après toute modification d'assets, **incrémenter la version du cache** dans `sw.js` (`tripa-vN`) pour forcer l'invalidation chez les utilisateurs ; les entrées `SHELL` du pré-cache doivent exister (`addAll` échoue atomiquement sinon).

## Sauvegarde des données
Réglages → Données : export **JSON** complet (toutes les entités) et restauration (remplace les données actuelles). Export CSV par entité depuis chaque tableau. Les données étant locales, l'export JSON périodique est la seule sauvegarde fiable (vidage du navigateur = perte des données).

## Maintenir la cohérence
- `js/api.js` expose le schéma des entités (`ENTITIES` : colonnes/types) — c'est la source unique pour les formulaires, tableaux, stats, exports et le journal.
- Les textes d'aide (FAQ, « À propos ») doivent décrire l'architecture **statique** : toute mention de serveur, cookie de session ou Super Admin est une anomalie à corriger.
