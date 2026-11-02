/* TRIPA — Réglages : profil + mot de passe */
document.addEventListener('DOMContentLoaded', async () => {
  const profile=await requireAuth(['active']); if(!profile) return;
  buildLayout('settings','Réglages');
  const content=document.getElementById('content');
  content.innerHTML=`
    <div class="grid grid--2">
      <div class="card">
        <div class="card__header"><h3>Mon profil</h3></div>
        <div class="card__body">
          <div class="field"><label class="label">Prénom</label><input class="input" id="prenom" value="${esc(profile.prenom||'')}"></div>
          <div class="field"><label class="label">Nom</label><input class="input" id="nom" value="${esc(profile.nom||'')}"></div>
          <div class="field"><label class="label">Email</label><input class="input" value="${esc(profile.email)}" disabled></div>
          <div class="field"><label class="label">Téléphone</label><input class="input" id="telephone" value="${esc(profile.telephone||'')}"></div>
          <button class="btn btn--primary" id="saveProfile">Enregistrer</button>
        </div>
      </div>
      <div class="card">
        <div class="card__header"><h3>Sécurité</h3></div>
        <div class="card__body">
          <div class="field"><label class="label">Mot de passe actuel</label><input class="input" type="password" id="curPwd"></div>
          <div class="field"><label class="label">Nouveau mot de passe</label><input class="input" type="password" id="newPwd" minlength="6"></div>
          <button class="btn btn--primary" id="savePwd">Changer le mot de passe</button>
          <p class="muted mt-4" style="font-size:13px;">⚠️ Sans serveur, l'authentification reste symbolique : ne stockez aucune donnée confidentielle.</p>
        </div>
      </div>
    </div>`;
  document.getElementById('saveProfile').addEventListener('click', async () => {
    const {error}=await updateOwnProfile({
      prenom:document.getElementById('prenom').value.trim(),
      nom:document.getElementById('nom').value.trim(),
      telephone:document.getElementById('telephone').value.trim() });
    if(error){ showToast('Erreur : '+error.message,'danger'); return; }
    showToast('Profil mis à jour.','success');
  });
  document.getElementById('savePwd').addEventListener('click', async () => {
    const cur=document.getElementById('curPwd').value, nw=document.getElementById('newPwd').value;
    const {error}=await changePassword(cur,nw);
    if(error){ showToast('Erreur : '+error.message,'danger'); return; }
    document.getElementById('curPwd').value=''; document.getElementById('newPwd').value='';
    showToast('Mot de passe modifié.','success');
  });
  if(window.lucide) lucide.createIcons();
});
