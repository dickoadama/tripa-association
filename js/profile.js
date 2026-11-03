/* TRIPA — Mon profil : vue d'ensemble du compte + activité (lecture seule).
 * L'édition des coordonnées et du mot de passe se fait dans Réglages. */
document.addEventListener('DOMContentLoaded', async () => {
  const profile = await requireAuth(['active']); if (!profile) return;
  buildLayout('profile', 'Mon profil');
  const content = document.getElementById('content');

  const initials = ((profile.prenom?.[0] || '') + (profile.nom?.[0] || '')).toUpperCase() || 'AD';
  const fullName = [profile.prenom, profile.nom].filter(Boolean).join(' ') || 'Admin';
  const roleLabel = profile.role === 'super_admin' ? 'Super Admin' : 'Administrateur';
  const roleBadge = profile.role === 'super_admin' ? 'info' : 'success';
  const statusLabel = { active: 'Actif', pending: 'En attente', suspended: 'Suspendu', rejected: 'Rejeté' }[profile.status] || humanize(profile.status);
  const statusBadge = { active: 'success', pending: 'warning', suspended: 'danger', rejected: 'muted' }[profile.status] || 'muted';
  const since = profile.created_at ? formatDate(profile.created_at) : '—';
  const asso = profile.asso_type ? humanize(profile.asso_type) : '—';

  content.innerHTML = `
    <div class="card mb-6">
      <div class="card__body row wrap" style="gap:20px;">
        <div class="avatar" style="width:72px;height:72px;font-size:26px;">${esc(initials)}</div>
        <div style="flex:1;min-width:220px;">
          <div class="row wrap" style="gap:10px;"><h2 style="font-size:22px;">${esc(fullName)}</h2>
            <span class="badge badge--${roleBadge}">${esc(roleLabel)}</span>
            <span class="badge badge--${statusBadge}">${esc(statusLabel)}</span></div>
          <div class="muted mt-4" style="font-size:14px;">
            <div><i data-lucide="mail" style="width:14px;height:14px;vertical-align:-2px;"></i> ${esc(profile.email || '—')}</div>
            <div class="mt-4"><i data-lucide="phone" style="width:14px;height:14px;vertical-align:-2px;"></i> ${esc(profile.telephone || 'Téléphone non renseigné')}</div>
          </div>
        </div>
        <div class="row wrap" style="gap:10px;">
          <a class="btn btn--primary" href="settings.html"><i data-lucide="pencil"></i> Modifier</a>
          <button class="btn btn--ghost" onclick="signOut()"><i data-lucide="log-out"></i> Déconnexion</button>
        </div>
      </div>
    </div>

    <div class="grid grid--2 mb-6">
      <div class="card">
        <div class="card__header"><h3>Informations de l'association</h3></div>
        <div class="card__body">
          <div class="between" style="padding:8px 0;border-bottom:1px solid var(--border);"><span class="muted">Type d'association</span><strong>${esc(asso)}</strong></div>
          <div class="between" style="padding:8px 0;border-bottom:1px solid var(--border);"><span class="muted">Membre depuis</span><strong>${esc(since)}</strong></div>
          <div class="between" style="padding:8px 0;"><span class="muted">Identifiant</span><strong style="font-size:12px;">${esc(String(profile.id || '').slice(0, 8))}…</strong></div>
        </div>
      </div>
      <div class="card">
        <div class="card__header"><h3>Mon activité</h3></div>
        <div class="card__body">
          <div class="grid grid--3" id="miniStats"><div class="skeleton" style="height:56px;"></div><div class="skeleton" style="height:56px;"></div><div class="skeleton" style="height:56px;"></div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__header"><h3>Sessions &amp; sécurité</h3></div>
      <div class="card__body">
        <p class="muted" style="font-size:14px;">🔒 Votre session est gérée par un cookie sécurisé (<code>httpOnly</code>) émis par le serveur : aucun mot de passe ni jeton n'est stocké dans ce navigateur. Pour changer votre mot de passe, rendez-vous dans <a href="settings.html">Réglages → Sécurité</a>.</p>
      </div>
    </div>`;

  await renderStats();
  if (window.lucide) lucide.createIcons();
  attachReveal && attachReveal();
});

async function renderStats() {
  const box = document.getElementById('miniStats'); if (!box) return;
  let counts = null;
  if (typeof fetchStats === 'function') { const { data } = await fetchStats(); if (data && data.counts) counts = data.counts; }
  if (!counts) {
    counts = {};
    for (const k of ['adherents', 'cotisations', 'taches']) { const { data } = await fetchAll(k, { limit: 5000 }); counts[k] = (data || []).length; }
  }
  const tiles = [
    { k: 'adherents', label: 'Adhérents' },
    { k: 'cotisations', label: 'Cotisations' },
    { k: 'taches', label: 'Tâches' }
  ];
  box.innerHTML = tiles.map(t => { const s = ENTITY_SCHEMA[t.k];
    return `<a class="card card--hover card__body" href="entity.html?t=${t.k}" style="text-align:center;">
      <i data-lucide="${s.icon}" style="color:var(--accent);width:22px;height:22px;"></i>
      <div style="font-size:24px;font-weight:600;">${Number(counts[t.k]) || 0}</div>
      <div class="muted" style="font-size:13px;">${t.label}</div></a>`; }).join('');
  if (window.lucide) lucide.createIcons();
}
