/* TRIPA — Console Super Admin (validation & gestion des comptes admin) */
let ADMINS=[], EDITING_ID=null;
const ASSO_LABELS={amicale:'Amicale',religieuse:'Religieuse',familiale:'Familiale'};
const STATUS_BADGE={ pending:{label:'En attente',color:'warning'}, active:{label:'Actif',color:'success'},
  suspended:{label:'Suspendu',color:'danger'}, rejected:{label:'Rejeté',color:'muted'} };

document.addEventListener('DOMContentLoaded', async () => {
  const me=await requireSuperAdmin(); if(!me) return;
  buildLayout('admin','Console Super Admin');
  await loadAdmins();
});

async function loadAdmins(){
  const {data,error}=await getAllAdmins();
  if(error){ showToast('Erreur : '+error.message,'danger'); ADMINS=[]; }
  else ADMINS=(data||[]).filter(a=>!isSuperAdminEmail(a.email));
  render();
}

function render(){
  const counts={pending:0,active:0,suspended:0,rejected:0};
  ADMINS.forEach(a=>{ if(counts[a.status]!==undefined) counts[a.status]++; });
  const content=document.getElementById('content');
  content.innerHTML=`
    <div class="grid grid--4 mb-6">
      <div class="card card__body"><div class="muted">En attente</div><div style="font-size:24px;font-weight:600;color:var(--warning)">${counts.pending}</div></div>
      <div class="card card__body"><div class="muted">Actifs</div><div style="font-size:24px;font-weight:600;color:var(--success)">${counts.active}</div></div>
      <div class="card card__body"><div class="muted">Suspendus</div><div style="font-size:24px;font-weight:600;color:var(--danger)">${counts.suspended}</div></div>
      <div class="card card__body"><div class="muted">Rejetés</div><div style="font-size:24px;font-weight:600">${counts.rejected}</div></div>
    </div>
    <div class="between wrap mb-6">
      <input class="input" id="searchInput" placeholder="Rechercher un admin..." style="max-width:320px;">
      <button class="btn btn--primary" id="createBtn"><i data-lucide="user-plus"></i> Créer un compte</button>
    </div>
    <div class="card"><table class="table" id="adminsTable"></table></div>`;
  document.getElementById('createBtn').addEventListener('click',()=>openForm());
  document.getElementById('searchInput').addEventListener('input',renderTable);
  renderTable();
  if(window.lucide) lucide.createIcons();
}

function rowActions(a){
  let html=`<button class="btn btn--ghost btn--sm" title="Modifier" onclick="openForm('${a.id}')"><i data-lucide="pencil"></i></button>`;
  if(a.status==='pending') html+=` <button class="btn btn--primary btn--sm" onclick="setStatus('${a.id}','active')">Valider</button>
    <button class="btn btn--ghost btn--sm" style="color:var(--danger)" onclick="setStatus('${a.id}','rejected')">Rejeter</button>`;
  else if(a.status==='active') html+=` <button class="btn btn--ghost btn--sm" style="color:var(--warning)" onclick="setStatus('${a.id}','suspended')">Suspendre</button>`;
  else html+=` <button class="btn btn--ghost btn--sm" style="color:var(--success)" onclick="setStatus('${a.id}','active')">Réactiver</button>`;
  html+=` <button class="btn btn--ghost btn--sm" onclick="resetPassword('${a.id}')" title="Mot de passe temporaire"><i data-lucide="key-round"></i></button>`;
  html+=` <button class="btn btn--ghost btn--sm" style="color:var(--danger)" onclick="removeAdmin('${a.id}')"><i data-lucide="trash-2"></i></button>`;
  return html;
}

function renderTable(){
  const q=(document.getElementById('searchInput').value||'').toLowerCase().trim();
  let list=ADMINS;
  if(q) list=ADMINS.filter(a=>`${a.prenom} ${a.nom}`.toLowerCase().includes(q)||(a.email||'').toLowerCase().includes(q));
  const table=document.getElementById('adminsTable');
  const head=`<thead><tr><th>Admin</th><th>Email</th><th>Association</th><th>Statut</th><th style="text-align:right;">Actions</th></tr></thead>`;
  if(!list.length){ table.innerHTML=`${head}<tbody><tr><td colspan="5"><div class="empty">Aucun compte admin</div></td></tr></tbody>`; if(window.lucide) lucide.createIcons(); return; }
  table.innerHTML=head+`<tbody>`+list.map(a=>{ const s=STATUS_BADGE[a.status]||STATUS_BADGE.pending;
    return `<tr><td><strong>${esc([a.prenom,a.nom].filter(Boolean).join(' ')||'—')}</strong><br><span class="muted" style="font-size:12px;">${esc(a.telephone||'')}</span></td>
      <td>${esc(a.email)}</td><td>${esc(ASSO_LABELS[a.asso_type]||a.asso_type||'—')}</td>
      <td><span class="badge badge--${s.color}">${s.label}</span></td>
      <td style="text-align:right;white-space:nowrap;">${rowActions(a)}</td></tr>`; }).join('')+`</tbody>`;
  if(window.lucide) lucide.createIcons();
}

async function setStatus(id,status){
  const {error}=await updateAdminAccount(id,{status});
  if(error){ showToast('Erreur : '+error.message,'danger'); return; }
  await loadAdmins(); showToast('Statut mis à jour.','success');
}

async function resetPassword(id){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const rnd=new Uint32Array(10);
  if(window.crypto && crypto.getRandomValues) crypto.getRandomValues(rnd);
  else for(let i=0;i<rnd.length;i++) rnd[i]=Math.floor(Math.random()*4294967296);
  let pwd=''; for(let i=0;i<10;i++) pwd+=chars[rnd[i]%chars.length];
  const {error}=await updateAdminAccount(id,{password:pwd});
  if(error){ showToast('Erreur : '+error.message,'danger'); return; }
  alert('Nouveau mot de passe temporaire :\n\n'+pwd+'\n\nCommuniquez-le de façon sécurisée.');
}

async function removeAdmin(id){
  if(!confirm('Supprimer définitivement ce compte admin et TOUTES ses données ?')) return;
  const {error}=await deleteAdminAccount(id);
  if(error){ showToast('Erreur : '+error.message,'danger'); return; }
  await loadAdmins(); showToast('Compte et données supprimés.','success');
}

function openForm(id){
  EDITING_ID=id||null;
  const a=id?ADMINS.find(x=>x.id===id):{};
  document.getElementById('adminModalTitle').textContent=id?'Modifier le compte':'Créer un compte admin';
  document.getElementById('adminForm').innerHTML=`
    ${!id?`<div class="field"><label class="label">Email *</label><input class="input" type="email" name="email" required></div>`:''}
    <div class="grid grid--2">
      <div class="field"><label class="label">Prénom</label><input class="input" name="prenom" value="${esc(a.prenom||'')}"></div>
      <div class="field"><label class="label">Nom</label><input class="input" name="nom" value="${esc(a.nom||'')}"></div>
    </div>
    <div class="field"><label class="label">Téléphone</label><input class="input" name="telephone" value="${esc(a.telephone||'')}"></div>
    <div class="field"><label class="label">Type d’association</label>
      <select class="select" name="asso_type">
        <option value="amicale" ${a.asso_type==='amicale'?'selected':''}>Amicale</option>
        <option value="religieuse" ${a.asso_type==='religieuse'?'selected':''}>Religieuse</option>
        <option value="familiale" ${a.asso_type==='familiale'?'selected':''}>Familiale</option>
      </select></div>
    <div class="field"><label class="label">${id?'Nouveau mot de passe (facultatif)':'Mot de passe * (min 6)'}</label>
      <input class="input" type="text" name="password" ${!id?'required':''} minlength="6"></div>
    <div class="row mt-4"><button type="submit" class="btn btn--primary">Enregistrer</button>
      <button type="button" class="btn btn--ghost" onclick="closeModal('adminModal')">Annuler</button></div>`;
  document.getElementById('adminForm').onsubmit=submitAdmin;
  openModal('adminModal');
  if(window.lucide) lucide.createIcons();
}

async function submitAdmin(e){
  e.preventDefault();
  const f=document.getElementById('adminForm');
  const data={ prenom:f.elements.prenom?.value?.trim()||'', nom:f.elements.nom?.value?.trim()||'',
    telephone:f.elements.telephone?.value?.trim()||'', asso_type:f.elements.asso_type?.value||'' };
  const pwd=f.elements.password?.value;
  let res;
  if(EDITING_ID){ if(pwd){ if(pwd.length<6){ showToast('Mot de passe trop court.','warning'); return; } data.password=pwd; }
    res=await updateAdminAccount(EDITING_ID,data); }
  else{ data.email=f.elements.email.value.trim().toLowerCase();
    if(!data.email||!pwd||pwd.length<6){ showToast('Email et mot de passe (6+ car.) requis.','warning'); return; }
    data.password=pwd; data.status='active'; res=await createAdminAccount(data); }
  if(res.error){ showToast('Erreur : '+res.error.message,'danger'); return; }
  closeModal('adminModal'); showToast('Compte enregistré.','success'); await loadAdmins();
}
