/* TRIPA — Réglages : profil + mot de passe + sauvegarde/restauration */
document.addEventListener('DOMContentLoaded', async () => {
  const profile = await requireAuth(['active']); if (!profile) return;
  buildLayout('settings', 'Réglages');
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="grid grid--2">
      <div class="card">
        <div class="card__header"><h3>Mon profil</h3></div>
        <div class="card__body">
          <div class="field"><label class="label">Prénom</label><input class="input" id="prenom" value="${esc(profile.prenom || '')}"></div>
          <div class="field"><label class="label">Nom</label><input class="input" id="nom" value="${esc(profile.nom || '')}"></div>
          <div class="field"><label class="label">Email</label><input class="input" value="${esc(profile.email)}" disabled></div>
          <div class="field"><label class="label">Téléphone</label><input class="input" id="telephone" value="${esc(profile.telephone || '')}"></div>
          <button class="btn btn--primary" id="saveProfile">Enregistrer</button>
        </div>
      </div>
      <div class="card">
        <div class="card__header"><h3>Sécurité</h3></div>
        <div class="card__body">
          <div class="field"><label class="label">Mot de passe actuel</label><input class="input" type="password" id="curPwd"></div>
          <div class="field"><label class="label">Nouveau mot de passe</label><input class="input" type="password" id="newPwd" minlength="6"></div>
          <button class="btn btn--primary" id="savePwd">Changer le mot de passe</button>
          <p class="muted mt-4" style="font-size:13px;">🔒 L'authentification et les données sont gérées par le serveur : le navigateur ne stocke aucun secret.</p>
        </div>
      </div>
      <div class="card" style="grid-column:1/-1;">
        <div class="card__header"><h3>Données — sauvegarde &amp; restauration</h3></div>
        <div class="card__body">
          <div class="row wrap">
            <button class="btn btn--ghost" id="backupBtn"><i data-lucide="download"></i> Télécharger ma sauvegarde (JSON)</button>
            <label class="btn btn--ghost" style="cursor:pointer;"><i data-lucide="upload"></i> Restaurer depuis un fichier
              <input type="file" id="restoreFile" accept=".json" style="display:none;"></label>
          </div>
          <p class="muted mt-4" style="font-size:13px;">⚠️ La restauration REMPLACE toutes vos données actuelles par celles du fichier.</p>
        </div>
      </div>
    </div>`;

  document.getElementById('saveProfile').addEventListener('click', async () => {
    const { error } = await updateOwnProfile({
      prenom: document.getElementById('prenom').value.trim(),
      nom: document.getElementById('nom').value.trim(),
      telephone: document.getElementById('telephone').value.trim() });
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    showToast('Profil mis à jour.', 'success');
  });

  document.getElementById('savePwd').addEventListener('click', async () => {
    const cur = document.getElementById('curPwd').value, nw = document.getElementById('newPwd').value;
    const { error } = await changePassword(cur, nw);
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    document.getElementById('curPwd').value = ''; document.getElementById('newPwd').value = '';
    showToast('Mot de passe modifié.', 'success');
  });

  document.getElementById('backupBtn').addEventListener('click', async () => {
    const { data, error } = await fetchBackup();
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'tripa-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    URL.revokeObjectURL(url); showToast('Sauvegarde téléchargée.', 'success');
  });

  document.getElementById('restoreFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    let parsed; try { parsed = JSON.parse(await file.text()); } catch (err) { showToast('Fichier JSON invalide.', 'danger'); return; }
    const entities = parsed && parsed.entities ? parsed.entities : parsed;
    if (!confirm('Restaurer remplacera TOUTES vos données actuelles. Continuer ?')) { e.target.value = ''; return; }
    const { error } = await restoreBackup(entities);
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    showToast('Restauration terminée.', 'success'); e.target.value = '';
  });

  if (window.lucide) lucide.createIcons();
});
