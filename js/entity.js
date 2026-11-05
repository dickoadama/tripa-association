/* TRIPA — Moteur CRUD générique + analyses (entity.html?t=<entité>).
 * Recherche/tri/pagination côté client. Export/import CSV. Sauvegarde.
 * Rôles : admin = CRUD complet (données cloisonnées par RLS) ;
 *         user  = lecture seule, sauf statut des tâches ;
 *         super_admin = n'utilise pas les modules de données (renvoyé console). */
let ENTITY_TYPE = '', ROWS = [], REF_MAPS = {}, EDITING_ID = null;
let READONLY = false, IS_ADMIN = false;
let STATE = { search: '', sort: 'created_at', dir: 'desc', page: 1, perPage: 25, hasMore: false };
function paramType(){ const t = new URLSearchParams(location.search).get('t'); return ENTITY_SCHEMA[t] ? t : 'adherents'; }

document.addEventListener('DOMContentLoaded', async () => {
  const profile = await requireAuth(['active']); if (!profile) return;
  if (profile.role === 'super_admin') { location.href = 'admin-management.html'; return; }
  READONLY = profile.role === 'user';
  IS_ADMIN = profile.role === 'admin';
  ENTITY_TYPE = paramType();
  const schema = ENTITY_SCHEMA[ENTITY_TYPE];
  document.title = 'TRIPA — ' + schema.label;
  await loadRefMaps();
  buildLayout(ENTITY_TYPE, schema.label);
  renderShell(schema);
  await loadData();
});

async function loadRefMaps(){
  REF_MAPS = {};
  for (const f of ENTITY_SCHEMA[ENTITY_TYPE].fields) {
    if (f.type === 'ref' && !REF_MAPS[f.ref]) {
      const { data } = await fetchAll(f.ref, { limit: 5000 });
      const map = {};
      (data || []).forEach(r => { map[r.id] = [r.prenom, r.nom].filter(Boolean).join(' ') || r.titre || r.nom || r.libelle || r.fournisseur || r.id.slice(0, 6); });
      REF_MAPS[f.ref] = map;
    }
  }
}

function renderShell(schema){
  const content = document.getElementById('content');
  const adminTools = READONLY ? '' : `
        <label class="btn btn--ghost btn--sm" style="cursor:pointer;"><i data-lucide="upload"></i> Import CSV
          <input type="file" id="importFile" accept=".csv" style="display:none;"></label>`;
  const addTool = READONLY ? '' : `
        <button class="btn btn--primary" id="addBtn"><i data-lucide="plus"></i> Nouveau ${esc(schema.singular)}</button>`;
  const inviteTool = (IS_ADMIN && ENTITY_TYPE === 'adherents')
    ? `<button class="btn btn--ghost" id="inviteBtn"><i data-lucide="mail-plus"></i> Inviter un utilisateur</button>` : '';
  content.innerHTML = `
    <div class="print-head" id="printHead">TRIPA — ${esc(schema.label)}</div>
    <div class="between wrap mb-6 no-print">
      <input class="input" id="searchInput" placeholder="Rechercher..." style="max-width:320px;">
      <div class="row wrap">
        <button class="btn btn--ghost btn--sm" id="exportBtn"><i data-lucide="download"></i> Export CSV</button>${adminTools}
        <button class="btn btn--ghost btn--sm" id="printBtn"><i data-lucide="printer"></i> PDF</button>${inviteTool}${addTool}
      </div>
    </div>
    ${READONLY ? '<div class="badge badge--info mb-4" style="display:inline-block;">👁 Accès lecture seule — votre administrateur gère les données.</div>' : ''}
    <div id="offlineBanner"></div>
    <div class="card"><div class="table-wrap"><table class="table" id="dataTable"></table></div></div>
    <div class="between mt-4 no-print"><span class="muted" id="pageInfo"></span>
      <div class="row"><button class="btn btn--ghost btn--sm" id="prevBtn">← Précédent</button>
      <button class="btn btn--ghost btn--sm" id="nextBtn">Suivant →</button></div></div>`;
  const addBtn = document.getElementById('addBtn');
  if (addBtn) addBtn.addEventListener('click', () => openForm());
  const inviteBtn = document.getElementById('inviteBtn');
  if (inviteBtn) inviteBtn.addEventListener('click', openInviteForm);
  document.getElementById('printBtn').addEventListener('click', printView);
  let dt;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(dt); dt = setTimeout(() => { STATE.search = e.target.value.trim(); STATE.page = 1; loadData(); }, 300);
  });
  document.getElementById('exportBtn').addEventListener('click', exportCsv);
  const importFile = document.getElementById('importFile');
  if (importFile) importFile.addEventListener('change', importCsv);
  document.getElementById('prevBtn').addEventListener('click', () => { if (STATE.page > 1) { STATE.page--; loadData(); } });
  document.getElementById('nextBtn').addEventListener('click', () => { if (STATE.hasMore) { STATE.page++; loadData(); } });
  if (window.lucide) lucide.createIcons();
}

async function loadData(){
  const { data, error } = await fetchAll(ENTITY_TYPE, { search: STATE.search, sort: STATE.sort, dir: STATE.dir, page: STATE.page, limit: STATE.perPage });
  if (error) {
    if (error.status === 0) showOffline(true);
    showToast('Erreur : ' + error.message, 'danger'); ROWS = []; renderTable(); return;
  }
  showOffline(false);
  ROWS = data || [];
  STATE.hasMore = ROWS.length === STATE.perPage;
  renderTable();
}

function showOffline(on){
  const b = document.getElementById('offlineBanner'); if (!b) return;
  b.innerHTML = on ? '<div class="badge badge--danger mb-4">⚠️ Hors-ligne : données susceptibles d’être non à jour.</div>' : '';
}

function cellValue(field, row){
  let v = row[field.key];
  if (field.type === 'ref') return `<span>${esc((REF_MAPS[field.ref] || {})[v] || '—')}</span>`;
  if (field.type === 'select' || field.type === 'bool') return badge(field.type === 'bool' ? !!v : v);
  if (field.key === 'montant' || field.key === 'tarif') return `<span>${formatCurrency(v)}</span>`;
  if (field.type === 'date') return `<span>${formatDate(v)}</span>`;
  return `<span>${v == null || v === '' ? '—' : esc(v)}</span>`;
}

function rowActionsCell(r){
  if (!READONLY) return `
      <button class="btn btn--ghost btn--sm" onclick="openForm('${r.id}')"><i data-lucide="pencil"></i></button>
      <button class="btn btn--ghost btn--sm" style="color:var(--danger)" onclick="removeRow('${r.id}')"><i data-lucide="trash-2"></i></button>`;
  if (ENTITY_TYPE === 'taches') return `
      <button class="btn btn--ghost btn--sm" onclick="openStatusForm('${r.id}')"><i data-lucide="check-square"></i> Statut</button>`;
  return '<span class="muted" style="font-size:12px;">lecture seule</span>';
}

function renderTable(){
  const schema = ENTITY_SCHEMA[ENTITY_TYPE];
  const cols = schema.fields.filter(f => f.list);
  const table = document.getElementById('dataTable');
  const head = `<thead><tr>${cols.map(c => {
    const active = STATE.sort === c.key;
    const arrow = active ? (STATE.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th data-key="${c.key}" style="cursor:pointer;">${esc(c.label)}${arrow}</th>`;
  }).join('')}<th style="text-align:right;">Actions</th></tr></thead>`;
  const info = document.getElementById('pageInfo'); if (info) info.textContent = `Page ${STATE.page} · ${ROWS.length} élément(s)`;
  if (!ROWS.length) { table.innerHTML = `${head}<tbody><tr><td colspan="${cols.length + 1}"><div class="empty">Aucun élément</div></td></tr></tbody>`; if (window.lucide) lucide.createIcons(); return; }
  const body = ROWS.map(r => `<tr>${cols.map(c => `<td>${cellValue(c, r)}</td>`).join('')}
    <td style="text-align:right;white-space:nowrap;">${rowActionsCell(r)}
    </td></tr>`).join('');
  table.innerHTML = `${head}<tbody>${body}</tbody>`;
  table.querySelectorAll('th[data-key]').forEach(th => th.addEventListener('click', () => {
    const k = th.getAttribute('data-key');
    if (STATE.sort === k) STATE.dir = STATE.dir === 'asc' ? 'desc' : 'asc'; else { STATE.sort = k; STATE.dir = 'asc'; }
    STATE.page = 1; loadData();
  }));
  if (window.lucide) lucide.createIcons();
}

function fieldInput(f, value){
  const v = value == null ? '' : value;
  if (f.type === 'select') { const opts = (f.options || []).map(o => `<option value="${o}" ${o === v ? 'selected' : ''}>${esc(humanize(o))}</option>`).join('');
    return `<select class="select" name="${f.key}"><option value="">—</option>${opts}</select>`; }
  if (f.type === 'bool') return `<input type="checkbox" name="${f.key}" ${v ? 'checked' : ''} style="width:auto;">`;
  if (f.type === 'ref') { const map = REF_MAPS[f.ref] || {}; const opts = Object.entries(map).map(([id, lbl]) => `<option value="${id}" ${id === v ? 'selected' : ''}>${esc(lbl)}</option>`).join('');
    return `<select class="select" name="${f.key}"><option value="">—</option>${opts}</select>`; }
  if (f.type === 'textarea') return `<textarea class="textarea" name="${f.key}">${esc(v)}</textarea>`;
  const inputType = f.type === 'number' ? 'number' : f.type;
  return `<input class="input" type="${inputType}" name="${f.key}" value="${esc(v)}">`;
}

function openForm(id){
  EDITING_ID = id || null;
  const schema = ENTITY_SCHEMA[ENTITY_TYPE];
  const row = id ? ROWS.find(r => r.id === id) : {};
  document.getElementById('formTitle').textContent = (id ? 'Modifier ' : 'Nouveau ') + schema.singular;
  document.getElementById('entityForm').innerHTML =
    schema.fields.map(f => `<div class="field${f.type === 'textarea' ? ' field--full' : ''}"><label class="label">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>${fieldInput(f, row[f.key])}</div>`).join('') +
    `<div class="row mt-4 field--full"><button type="submit" class="btn btn--primary"><i data-lucide="save"></i> Enregistrer</button>
      <button type="button" class="btn btn--ghost" onclick="closeModal('formModal')">Annuler</button></div>`;
  document.getElementById('entityForm').onsubmit = submitForm;
  openModal('formModal');
  if (window.lucide) lucide.createIcons();
}

async function submitForm(e){
  e.preventDefault();
  const schema = ENTITY_SCHEMA[ENTITY_TYPE];
  const formEl = document.getElementById('entityForm');
  const payload = {};
  for (const f of schema.fields) {
    const el = formEl.elements[f.key]; if (!el) continue;
    let val;
    if (f.type === 'bool') val = el.checked;
    else if (f.type === 'number') val = el.value === '' ? null : Number(el.value);
    else val = el.value;
    if (f.required && (val === '' || val === null || val === undefined)) { showToast(f.label + ' est obligatoire.', 'warning'); return; }
    payload[f.key] = val;
  }
  const res = EDITING_ID ? await updateRow(ENTITY_TYPE, EDITING_ID, payload) : await insertRow(ENTITY_TYPE, payload);
  if (res.error) { showToast('Erreur : ' + res.error.message, 'danger'); return; }
  closeModal('formModal'); showToast(ENTITY_SCHEMA[ENTITY_TYPE].singular + ' enregistré.', 'success');
  await loadRefMaps(); await loadData();
}

async function removeRow(id){
  if (!confirm('Supprimer cet élément ?')) return;
  const { error } = await deleteRow(ENTITY_TYPE, id);
  if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
  ROWS = ROWS.filter(r => r.id !== id); renderTable(); showToast('Élément supprimé.', 'success');
}

/* ---------- Impression / export PDF ---------- */
async function printView(){
  const head = document.getElementById('printHead');
  const { data, error } = await fetchAll(ENTITY_TYPE, { limit: 5000, search: STATE.search, sort: STATE.sort, dir: STATE.dir });
  if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
  const prev = ROWS.slice();
  ROWS = data || []; renderTable();
  if (head) head.innerHTML = `TRIPA — ${esc(ENTITY_SCHEMA[ENTITY_TYPE].label)} <span class="muted" style="font-weight:400;font-size:13px;">· ${ROWS.length} élément(s) · ${formatDate(new Date())}</span>`;
  const restore = () => { ROWS = prev; renderTable(); window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  window.print();
  setTimeout(restore, 800);
}

/* ---------- Export / Import CSV ---------- */
function csvCell(s){ s = s == null ? '' : String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
async function exportCsv(){
  const schema = ENTITY_SCHEMA[ENTITY_TYPE];
  const { data } = await fetchAll(ENTITY_TYPE, { limit: 5000 });
  const rows = data || [];
  const header = ['id', ...schema.fields.map(f => f.key)].map(csvCell).join(',');
  const lines = rows.map(r => [r.id, ...schema.fields.map(f => r[f.key] === undefined ? '' : (typeof r[f.key] === 'boolean' ? (r[f.key] ? 'true' : 'false') : r[f.key]))].map(csvCell).join(','));
  download(ENTITY_TYPE + '.csv', [header, ...lines].join('\n'), 'text/csv;charset=utf-8;');
}
function download(name, text, mime){
  const blob = new Blob([text], { type: mime }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function parseCSV(text){
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (cur !== '' || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; } if (ch === '\r' && text[i + 1] === '\n') i++; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
async function importCsv(e){
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  const rows = parseCSV(text); if (rows.length < 2) { showToast('CSV vide ou invalide.', 'warning'); return; }
  const header = rows[0]; const schema = ENTITY_SCHEMA[ENTITY_TYPE];
  let ok = 0, fail = 0;
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    header.forEach((h, idx) => {
      const key = h.trim(); if (key === 'id') return;
      const f = schema.fields.find(x => x.key === key); if (!f) return;
      let v = rows[i][idx] == null ? '' : String(rows[i][idx]).trim();
      if (f.type === 'number') v = v === '' ? null : Number(v);
      else if (f.type === 'bool') v = (v === 'true' || v === '1');
      obj[key] = v;
    });
    const { error } = await insertRow(ENTITY_TYPE, obj);
    if (error) fail++; else ok++;
  }
  showToast(`Import terminé : ${ok} ajoutée(s), ${fail} échec(s).`, fail ? 'warning' : 'success');
  e.target.value = '';
  await loadRefMaps(); await loadData();
}

/* ---------- Rôle user : modification du seul statut des tâches ---------- */
function openStatusForm(id){
  EDITING_ID = id;
  const row = ROWS.find(r => r.id === id) || {};
  const field = ENTITY_SCHEMA.taches.fields.find(f => f.key === 'statut');
  document.getElementById('formTitle').textContent = 'Changer le statut de la tâche';
  document.getElementById('entityForm').innerHTML =
    `<div class="field field--full"><label class="label">${esc(field.label)}</label>${fieldInput(field, row.statut)}</div>
     <p class="muted" style="font-size:13px;">En tant qu'utilisateur, vous ne pouvez modifier que le statut des tâches.</p>
     <div class="row mt-4 field--full"><button type="submit" class="btn btn--primary"><i data-lucide="save"></i> Enregistrer</button>
      <button type="button" class="btn btn--ghost" onclick="closeModal('formModal')">Annuler</button></div>`;
  document.getElementById('entityForm').onsubmit = async e => {
    e.preventDefault();
    const statut = e.target.elements.statut.value;
    const res = await updateRow('taches', EDITING_ID, { statut });
    if (res.error) { showToast('Erreur : ' + res.error.message, 'danger'); return; }
    closeModal('formModal'); showToast('Statut mis à jour.', 'success');
    await loadData();
  };
  openModal('formModal');
  if (window.lucide) lucide.createIcons();
}

/* ---------- Admin : inviter un utilisateur depuis les adhérents ---------- */
function openInviteForm(){
  let m = document.getElementById('inviteModal');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal'; m.id = 'inviteModal';
    m.innerHTML = `<div class="modal__box"><div class="card__header"><h3>Inviter un utilisateur</h3>
      <button class="btn btn--icon btn--ghost" onclick="closeModal('inviteModal')"><i data-lucide="x"></i></button></div>
      <div class="card__body"><form id="inviteForm" class="form-grid">
        <div class="field field--full"><label class="label">Email <span class="req">*</span></label><input class="input" type="email" name="email" placeholder="personne@exemple.com"></div>
        <div class="field"><label class="label">Prénom</label><input class="input" name="prenom"></div>
        <div class="field"><label class="label">Nom</label><input class="input" name="nom"></div>
        <div class="row mt-4 field--full"><button type="submit" class="btn btn--primary"><i data-lucide="mail-plus"></i> Générer le lien d'invitation</button>
          <button type="button" class="btn btn--ghost" onclick="closeModal('inviteModal')">Fermer</button></div>
      </form><div id="inviteOut"></div></div></div>`;
    document.body.appendChild(m);
    m.querySelector('#inviteForm').onsubmit = submitInvite;
  }
  document.getElementById('inviteOut').innerHTML = '';
  openModal('inviteModal');
  if (window.lucide) lucide.createIcons();
}

async function submitInvite(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email invalide.', 'danger'); return; }
  const { data, error } = await createInvitation({ email, role: 'user',
    prenom: String(fd.get('prenom') || '').trim(), nom: String(fd.get('nom') || '').trim() });
  if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
  const link = invitationLink(data.token);
  const out = document.getElementById('inviteOut');
  out.innerHTML = `<div class="auth__alert show auth__alert--ok mt-4" style="position:static;">
    <span>Invitation créée pour <b>${esc(email)}</b> :</span><br>
    <code style="font-size:12px;word-break:break-all;display:inline-block;margin-top:6px;">${esc(link)}</code><br>
    <button class="btn btn--ghost btn--sm mt-2" id="copyInviteBtn"><i data-lucide="copy"></i> Copier le lien</button>
    <a class="btn btn--ghost btn--sm mt-2" href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Invitation TRIPA')}&body=${encodeURIComponent('Rejoignez TRIPA via ce lien :\n' + link)}"><i data-lucide="mail"></i> Envoyer</a></div>`;
  document.getElementById('copyInviteBtn').addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(link); ok = true; }
    catch (_) { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta);
      ta.select(); try { ok = document.execCommand('copy'); } catch (__) {} ta.remove(); }
    showToast(ok ? 'Lien copié.' : 'Copie impossible — sélectionnez le lien manuellement.', ok ? 'success' : 'warning');
  });
  if (window.lucide) lucide.createIcons();
  showToast('Invitation créée.', 'success');
}
