/* TRIPA — Aide & À propos : guide des modules, raccourcis, FAQ dépliables. */
document.addEventListener('DOMContentLoaded', async () => {
  const profile = await requireAuth(['active', 'pending', 'suspended']); if (!profile) return;
  buildLayout('help', 'Aide & À propos');
  const content = document.getElementById('content');

  const modules = Object.keys(ENTITY_SCHEMA).map(k => {
    const s = ENTITY_SCHEMA[k];
    const champs = s.fields.filter(f => f.list).map(f => f.label).slice(0, 5).join(', ');
    return `<div class="card card--hover card__body row" style="gap:12px;">
      <i data-lucide="${s.icon}" style="color:var(--accent);width:22px;height:22px;flex-shrink:0;"></i>
      <div><strong>${esc(s.label)}</strong><div class="muted" style="font-size:13px;">${esc(champs)}</div></div></div>`;
  }).join('');

  const faq = [
    ['Comment ajouter un élément ?', "Ouvrez le module voulu dans le menu de gauche, puis cliquez sur « Ajouter ». Le formulaire s'adapte automatiquement aux champs de l'entité. Les champs marqués d'un astérisque sont obligatoires."],
    ['Rechercher rapidement', "Utilisez la barre de recherche de l'en-tête (raccourci Ctrl+K) pour chercher dans tous vos modules à la fois, ou la recherche interne d'un tableau pour filtrer ses lignes."],
    ['Exporter mes données', "Dans chaque tableau, le bouton « Export CSV » génère un fichier. Dans Réglages → Données, vous pouvez télécharger une sauvegarde complète (JSON) et la restaurer."],
    ['Qui sont le Super Admin, les administrateurs et les utilisateurs ?', "Un unique Super Admin gère les comptes : il crée des administrateurs via des liens d'invitation. Chaque administrateur invite à son tour des utilisateurs. Les données de chaque administrateur sont cloisonnées : un utilisateur voit (en lecture) les données de l'administrateur auquel il est rattaché et peut mettre à jour le statut des tâches."],
    ['Comment inviter quelqu\'un ?', "En tant qu'administrateur : Tableau de bord ou Adhérents → « Inviter un utilisateur », puis transmettez le lien généré (copie ou email). La personne clique sur le lien, crée son compte, et rejoint votre espace."],
    ['Fonctionner hors-ligne', "TRIPA est une application installable (PWA) : l'interface reste disponible hors-ligne, mais la synchronisation de vos données nécessite une connexion internet une fois authentifié."],
    ['Oubli du mot de passe', "Utilisez « Mot de passe oublié ? » sur la page de connexion : vous recevrez un email de réinitialisation. Sans accès à votre email, contactez le Super Admin qui pourra réactiver ou révoquer le compte."],
    ['Mes données sont-elles protégées ?', "Oui. Vos données sont stockées sur un cloud sécurisé (Supabase) et strictement cloisonnées par compte grâce aux politiques RLS : personne d'autre que vous (et les utilisateurs que vous invitez) n'y accède. Votre mot de passe n'est jamais stocké en clair dans le navigateur."]
  ].map(([q, r], i) => `<details class="faq"><summary>${esc(q)}</summary><div class="faq__a">${esc(r)}</div></details>`).join('');

  content.innerHTML = `
    <div class="card mb-6">
      <div class="card__header"><h3>Bienvenue sur TRIPA</h3><span class="badge badge--info">v3.0</span></div>
      <div class="card__body">
        <p class="muted">TRIPA est une plateforme de gestion d'association : adhérents, cotisations, événements, activités, annonces, achats, documents et tâches. Les comptes sont multi-rôles (Super Admin, administrateurs, utilisateurs invités par lien) et les données, stockées sur un cloud sécurisé, restent cloisonnées à votre compte. L'interface s'adapte à vos préférences (thème, couleur, densité) dans <a href="settings.html">Réglages</a>.</p>
      </div>
    </div>

    <h3 class="mb-4">Modules disponibles</h3>
    <div class="grid grid--3 mb-6">${modules}</div>

    <div class="grid grid--2 mb-6">
      <div class="card">
        <div class="card__header"><h3>Raccourcis clavier</h3></div>
        <div class="card__body">
          <div class="between" style="padding:6px 0;"><span>Recherche globale</span><kbd>Ctrl</kbd> + <kbd>K</kbd></div>
          <div class="between" style="padding:6px 0;"><span>Fermer une fenêtre / un menu</span><kbd>Échap</kbd></div>
        </div>
      </div>
      <div class="card">
        <div class="card__header"><h3>À propos</h3></div>
        <div class="card__body">
          <div class="between" style="padding:6px 0;"><span class="muted">Version</span><strong>TRIPA 3.0</strong></div>
          <div class="between" style="padding:6px 0;"><span class="muted">Architecture</span><strong>Frontend statique + cloud Supabase (RLS)</strong></div>
          <div class="between" style="padding:6px 0;"><span class="muted">Comptes</span><strong>Super Admin · Administrateurs · Utilisateurs</strong></div>
          <div class="between" style="padding:6px 0;"><span class="muted">Interface</span><strong>HTML / CSS / JS natif</strong></div>
          <div class="between" style="padding:6px 0;"><span class="muted">Hors-ligne</span><strong>Application installable (PWA)</strong></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__header"><h3>Questions fréquentes</h3></div>
      <div class="card__body">${faq}</div>
    </div>`;

  content.querySelectorAll('.faq summary').forEach(s => s.addEventListener('click', () => {}));
  if (window.lucide) lucide.createIcons();
  attachReveal && attachReveal();
});
