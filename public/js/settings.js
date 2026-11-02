/* TRIPA — Réglages : onglets Profil · Apparence · Notifications · Données · Sécurité. */
let SET_TAB = 'profil';
let SET_PROFILE = null;

document.addEventListener('DOMContentLoaded', async () => {
  const profile = await requireAuth(['active']); if (!profile) return;
  SET_PROFILE = profile;
  buildLayout('settings', 'Réglages');
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="tabs" id="setTabs">
      <div class="tab" data-tab="profil"><i data-lucide="user"></i> Profil</div>
      <div class="tab" data-tab="apparence"><i data-lucide="palette"></i> Apparence</div>
      <div class="tab" data-tab="notifications"><i data-lucide="bell"></i> Notifications</div>
      <div class="tab" data-tab="donnees"><i data-lucide="database"></i> Données</div>
      <div class="tab" data-tab="securite"><i data-lucide="shield"></i> Sécurité</div>
    </div>
    <div id="setPanel"></div>`;
  content.querySelectorAll('#setTabs .tab').forEach(t =>
    t.addEventListener('click', () => { SET_TAB = t.dataset.tab; renderSettings(); }));
  renderSettings();
});

function renderSettings() {
  document.querySelectorAll('#setTabs .tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === SET_TAB));
  const panel = document.getElementById('setPanel');
  const P = window.TRIPA && TRIPA.PREFS ? TRIPA.PREFS.get() : { theme: 'light', accent: 'indigo', density: 'comfortable', notifications: true };
  if (SET_TAB === 'profil') panel.innerHTML = viewProfil();
  else if (SET_TAB === 'apparence') panel.innerHTML = viewApparence(P);
  else if (SET_TAB === 'notifications') panel.innerHTML = viewNotif(P);
  else if (SET_TAB === 'donnees') panel.innerHTML = viewDonnees();
  else if (SET_TAB === 'securite') panel.innerHTML = viewSecurite();
  wireSettings();
  if (window.lucide) lucide.createIcons();
  attachRipple && attachRipple(panel);
}

/* ---------- Vues ---------- */
function viewProfil() {
  const p = SET_PROFILE || {};
  return `<div class="card" style="max-width:560px;"><div class="card__header"><h3>Mes coordonnées</h3></div>
    <div class="card__body">
      <div class="field"><label class="label">Prénom</label><input class="input" id="prenom" value="${esc(p.prenom || '')}"></div>
      <div class="field"><label class="label">Nom</label><input class="input" id="nom" value="${esc(p.nom || '')}"></div>
      <div class="field"><label class="label">Email</label><input class="input" value="${esc(p.email || '')}" disabled></div>
      <div class="field"><label class="label">Téléphone</label><input class="input" id="telephone" value="${esc(p.telephone || '')}"></div>
      <button class="btn btn--primary" id="saveProfile"><i data-lucide="save"></i> Enregistrer</button>
    </div></div>`;
}

function seg(name, value, current, opts) {
  return `<div class="field"><label class="label">${esc(name)}</label><div class="row wrap" data-seg="${esc(value)}">` +
    opts.map(o => `<button class="btn btn--ghost${o.v === current ? ' seg-active' : ''}" data-segval="${esc(o.v)}">${esc(o.label)}</button>`).join('') +
    `</div></div>`;
}

function viewApparence(P) {
  const sw = Object.entries(TRIPA.PREFS.ACCENTS).map(([k, hex]) =>
    `<span class="swatch${P.accent === k ? ' is-active' : ''}" data-accent="${k}" title="${esc(k)}" style="background:${hex};"></span>`).join('');
  return `<div class="card" style="max-width:640px;"><div class="card__header"><h3>Apparence</h3></div>
    <div class="card__body">
      ${seg('Thème', 'theme', P.theme, [{ v: 'light', label: '☀️ Clair' }, { v: 'dark', label: '🌙 Sombre' }])}
      <div class="field"><label class="label">Couleur d'accent</label><div class="swatches" data-seg="accent">${sw}</div></div>
      ${seg('Densité', 'density', P.density, [{ v: 'comfortable', label: 'Confortable' }, { v: 'compact', label: 'Compacte' }])}
      <p class="muted" style="font-size:13px;">Les changements sont appliqués immédiatement et mémorisés dans ce navigateur.</p>
    </div></div>`;
}

function viewNotif(P) {
  return `<div class="card" style="max-width:560px;"><div class="card__header"><h3>Notifications</h3></div>
    <div class="card__body">
      ${seg('Afficher la cloche de notifications', 'notifications', P.notifications ? 'on' : 'off', [{ v: 'on', label: 'Activées' }, { v: 'off', label: 'Désactivées' }])}
      <p class="muted" style="font-size:13px;">La cloche de l'en-tête rassemble les tâches, événements et annonces les plus récents.</p>
    </div></div>`;
}

function viewDonnees() {
  return `<div class="card" style="max-width:640px;"><div class="card__header"><h3>Sauvegarde &amp; restauration</h3></div>
    <div class="card__body">
      <div class="row wrap">
        <button class="btn btn--ghost" id="backupBtn"><i data-lucide="download"></i> Télécharger ma sauvegarde (JSON)</button>
        <label class="btn btn--ghost" style="cursor:pointer;"><i data-lucide="upload"></i> Restaurer depuis un fichier
          <input type="file" id="restoreFile" accept=".json" style="display:none;"></label>
      </div>
      <p class="muted mt-4" style="font-size:13px;">⚠️ La restauration REMPLACE toutes vos données actuelles par celles du fichier.</p>
    </div></div>`;
}

function viewSecurite() {
  return `<div class="card" style="max-width:560px;"><div class="card__header"><h3>Mot de passe</h3></div>
    <div class="card__body">
      <div class="field"><label class="label">Mot de passe actuel</label><input class="input" type="password" id="curPwd"></div>
      <div class="field"><label class="label">Nouveau mot de passe</label><input class="input" type="password" id="newPwd" minlength="6"></div>
      <button class="btn btn--primary" id="savePwd"><i data-lucide="key-round"></i> Changer le mot de passe</button>
      <p class="muted mt-4" style="font-size:13px;">🔒 L'authentification est gérée par le serveur : le navigateur ne stocke aucun secret.</p>
    </div></div>`;
}

/* ---------- Interactions ---------- */
function wireSettings() {
  const sp = document.getElementById('saveProfile');
  if (sp) sp.addEventListener('click', async () => {
    const { error } = await updateOwnProfile({
      prenom: document.getElementById('prenom').value.trim(),
      nom: document.getElementById('nom').value.trim(),
      telephone: document.getElementById('telephone').value.trim() });
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    const { data } = await fetchCurrentUser(); if (data) { SET_PROFILE = data; saveSessionProfile(data); }
    showToast('Profil mis à jour.', 'success');
  });

  const pw = document.getElementById('savePwd');
  if (pw) pw.addEventListener('click', async () => {
    const cur = document.getElementById('curPwd').value, nw = document.getElementById('newPwd').value;
    const { error } = await changePassword(cur, nw);
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    document.getElementById('curPwd').value = ''; document.getElementById('newPwd').value = '';
    showToast('Mot de passe modifié.', 'success');
  });

  const bk = document.getElementById('backupBtn');
  if (bk) bk.addEventListener('click', async () => {
    const { data, error } = await fetchBackup();
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'tripa-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    URL.revokeObjectURL(url); showToast('Sauvegarde téléchargée.', 'success');
  });

  const rf = document.getElementById('restoreFile');
  if (rf) rf.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    let parsed; try { parsed = JSON.parse(await file.text()); } catch (err) { showToast('Fichier JSON invalide.', 'danger'); return; }
    const entities = parsed && parsed.entities ? parsed.entities : parsed;
    if (!confirm('Restaurer remplacera TOUTES vos données actuelles. Continuer ?')) { e.target.value = ''; return; }
    const { error } = await restoreBackup(entities);
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    showToast('Restauration terminée.', 'success'); e.target.value = '';
  });

  // Segments (thème / densité / notifications)
  document.querySelectorAll('[data-seg]').forEach(group => {
    const key = group.dataset.seg;
    group.querySelectorAll('[data-segval]').forEach(btn => btn.addEventListener('click', () => {
      let val = btn.dataset.segval;
      const patch = {};
      if (key === 'notifications') patch.notifications = val === 'on';
      else patch[key] = val;
      TRIPA.PREFS.set(patch);
      group.querySelectorAll('[data-segval]').forEach(b => b.classList.toggle('seg-active', b === btn));
      showToast('Préférence enregistrée.', 'success', 1600);
      if (key === 'notifications') { /* cloche appliquée au prochain chargement */ }
    }));
  });

  // Swatches d'accent
  document.querySelectorAll('.swatch[data-accent]').forEach(s => s.addEventListener('click', () => {
    TRIPA.PREFS.set({ accent: s.dataset.accent });
    document.querySelectorAll('.swatch[data-accent]').forEach(x => x.classList.toggle('is-active', x === s));
    showToast('Couleur appliquée.', 'success', 1600);
  }));
}
