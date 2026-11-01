/* ==========================================
   TRIPA — Console Super Admin (admin-management.js)
   Gestion des comptes admin via l'API TRIPA
   (backend Express + SQLite, dossier server/).
   ========================================== */

let ALL_ADMINS = [];
let currentAdminId = null;

const STATUS_LABELS = {
  pending:   { label: 'En attente',  color: 'warning' },
  active:    { label: 'Actif',       color: 'success' },
  suspended: { label: 'Suspendu',    color: 'danger' },
  rejected:  { label: 'Rejeté',      color: 'ghost' }
};

const ASSO_LABELS = { religieuse: '🕊️ Religieuse', amicale: '🤝 Amicale', familiale: '👨‍👩‍👧‍👦 Familiale' };

// Escape user-provided values before injecting into HTML
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function findAdmin(id) {
  return ALL_ADMINS.find(x => x.id === id);
}

// ==========================================
// Init
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  // Guard: only the super admin may access this page
  const me = await requireSuperAdmin();
  if (!me) return;

  initHeader(me);

  document.getElementById('logout-link').addEventListener('click', async (e) => {
    e.preventDefault();
    await logoutUser();
    window.location.href = 'index.html';
  });

  document.getElementById('search-input').addEventListener('input', renderAdmins);
  document.getElementById('filter-status').addEventListener('change', renderAdmins);
  document.getElementById('btn-generate-pwd').addEventListener('click', generateTempPassword);
  document.getElementById('create-admin-form').addEventListener('submit', createAdmin);

  // Édition d'identité + mot de passe personnalisé
  document.getElementById('btn-edit-from-details').addEventListener('click', () => {
    closeModal('admin-details-modal');
    if (currentAdminId) openEditAdmin(currentAdminId);
  });
  document.getElementById('btn-set-custom-pwd').addEventListener('click', setCustomPassword);
  document.getElementById('edit-admin-form').addEventListener('submit', saveAdminEdit);
  ['edit-firstname', 'edit-lastname'].forEach(id =>
    document.getElementById(id).addEventListener('input', updateEditInitials));

  await loadAdmins();
});

// ==========================================
// Data loading
// ==========================================

async function loadAdmins() {
  const { data, error } = await getAllAdmins();
  if (error) {
    showToast('Erreur chargement: ' + error.message, 'danger');
    ALL_ADMINS = [];
  } else {
    // Le serveur exclut déjà le Super Admin de la liste
    ALL_ADMINS = (data || []).filter(a => !isSuperAdminEmail(a.email));
  }
  renderAdmins();
}

// ==========================================
// Rendering
// ==========================================

function renderAdmins() {
  const search = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const filter = document.getElementById('filter-status').value;

  // Stats (all admins, unfiltered)
  const counts = { pending: 0, active: 0, suspended: 0, rejected: 0 };
  ALL_ADMINS.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
  document.getElementById('stat-pending').textContent = counts.pending;
  document.getElementById('stat-active').textContent = counts.active;
  document.getElementById('stat-suspended').textContent = counts.suspended;
  document.getElementById('stat-rejected').textContent = counts.rejected;

  let list = ALL_ADMINS;
  if (filter !== 'all') list = list.filter(a => a.status === filter);
  if (search) list = list.filter(a =>
    `${a.first_name} ${a.last_name}`.toLowerCase().includes(search) ||
    (a.email || '').toLowerCase().includes(search)
  );

  const tbody = document.getElementById('admins-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i data-lucide="inbox" style="width:32px;height:32px;"></i><p>Aucun admin trouvé</p></div></td></tr>';
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = list.map(a => {
    const s = STATUS_LABELS[a.status] || STATUS_LABELS.pending;
    const initials = esc(((a.first_name || '?')[0] + (a.last_name || '')).toUpperCase());
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--accent,#f59e0b);color:#000;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0;">${initials}</div>
            <span>${esc(a.first_name)} ${esc(a.last_name)}</span>
          </div>
        </td>
        <td>${esc(a.email)}</td>
        <td>${esc(a.phone || '—')}</td>
        <td>${esc(ASSO_LABELS[a.asso_type] || a.asso_type || '—')}</td>
        <td><span class="badge badge--${s.color} badge--dot">${s.label}</span></td>
        <td>${a.created_at ? formatDate(a.created_at) : '—'}</td>
        <td class="action-cell">${renderActions(a)}</td>
      </tr>`;
  }).join('');
  lucide.createIcons();
}

function renderActions(a) {
  const key = a.id;
  let html = `<button class="btn-xs btn-xs--ghost" onclick="openDetails('${key}')" title="Voir détails"><i data-lucide="eye" style="width:12px;height:12px;"></i></button>`;
  html += `<button class="btn-xs btn-xs--ghost" onclick="openEditAdmin('${key}')" title="Modifier identité / initiales"><i data-lucide="pencil" style="width:12px;height:12px;"></i></button>`;

  if (a.status === 'pending') {
    html += `
      <button class="btn-xs btn-xs--success" onclick="changeStatus('${key}','active')" title="Valider"><i data-lucide="check" style="width:12px;height:12px;"></i> Valider</button>
      <button class="btn-xs btn-xs--danger" onclick="changeStatus('${key}','rejected')" title="Rejeter"><i data-lucide="x" style="width:12px;height:12px;"></i> Rejeter</button>`;
  } else if (a.status === 'active') {
    html += `<button class="btn-xs btn-xs--warning" onclick="changeStatus('${key}','suspended')" title="Suspendre"><i data-lucide="pause-circle" style="width:12px;height:12px;"></i> Suspendre</button>`;
  } else if (a.status === 'suspended' || a.status === 'rejected') {
    html += `<button class="btn-xs btn-xs--success" onclick="changeStatus('${key}','active')" title="Réactiver"><i data-lucide="play" style="width:12px;height:12px;"></i> Réactiver</button>`;
  }

  html += `<button class="btn-xs btn-xs--danger" onclick="deleteAdmin('${key}')" title="Supprimer"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>`;
  return html;
}

// ==========================================
// Admin actions
// ==========================================

async function changeStatus(adminId, newStatus) {
  const msgs = { active: 'validé et activé', rejected: 'rejeté', suspended: 'suspendu' };
  if (!confirm(`Confirmer : rendre ce compte « ${msgs[newStatus] || newStatus} » ?`)) return;

  const { error } = await updateAdminAccount(adminId, { status: newStatus });
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  await loadAdmins();
  showToast(`Compte ${msgs[newStatus] || newStatus}.`, 'success');
}

async function deleteAdmin(adminId) {
  if (!confirm('Supprimer définitivement ce compte admin (et TOUTES ses données) ?')) return;

  const { error } = await deleteAdminAccount(adminId);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  await loadAdmins();
  showToast('Compte et données supprimés.', 'success');
}

// ==========================================
// Details + temporary password
// ==========================================

function openDetails(adminId) {
  currentAdminId = adminId;
  const a = findAdmin(adminId);
  if (!a) return;

  const s = STATUS_LABELS[a.status] || STATUS_LABELS.pending;
  document.getElementById('details-info').innerHTML = `
    <div><strong>Nom :</strong> ${esc(a.first_name)} ${esc(a.last_name)}</div>
    <div><strong>Email :</strong> ${esc(a.email)}</div>
    <div><strong>Téléphone :</strong> ${esc(a.phone || '—')}</div>
    <div><strong>Association :</strong> ${esc(ASSO_LABELS[a.asso_type] || a.asso_type || '—')}</div>
    <div><strong>Statut :</strong> <span class="badge badge--${s.color}">${s.label}</span></div>`;

  const box = document.getElementById('temp-pwd-box');
  box.style.display = 'none';
  box.textContent = '';

  openModal('admin-details-modal');
}

async function generateTempPassword() {
  if (!currentAdminId) return;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  const arr = new Uint32Array(12);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  for (let i = 0; i < 12; i++) pwd += chars[arr[i] % chars.length];

  const { error } = await updateAdminAccount(currentAdminId, { password: pwd });
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  const box = document.getElementById('temp-pwd-box');
  box.textContent = pwd;
  box.style.display = 'block';
  showToast('Mot de passe temporaire défini. Communiquez-le à l\'admin de façon sécurisée.', 'success', 6000);
}

// ==========================================
// Modifier identité / initiales / mot de passe
// ==========================================

function openEditAdmin(adminId) {
  const a = findAdmin(adminId);
  if (!a) return;
  currentAdminId = adminId;

  document.getElementById('edit-admin-id').value = a.id;
  document.getElementById('edit-firstname').value = a.first_name || '';
  document.getElementById('edit-lastname').value = a.last_name || '';
  document.getElementById('edit-email').value = a.email || '';
  document.getElementById('edit-phone').value = a.phone || '';
  document.getElementById('edit-asso-type').value = a.asso_type || 'amicale';
  document.getElementById('custom-pwd') && (document.getElementById('custom-pwd').value = '');
  updateEditInitials();

  openModal('edit-admin-modal');
  lucide.createIcons();
}

// Aperçu en direct des initiales (dérivées du prénom + nom)
function updateEditInitials() {
  const f = document.getElementById('edit-firstname').value.trim();
  const l = document.getElementById('edit-lastname').value.trim();
  const initials = ((f ? f[0] : '?') + (l ? l[0] : '')).toUpperCase();
  document.getElementById('edit-initials-avatar').textContent = initials;
}

async function saveAdminEdit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-admin-id').value;
  const updates = {
    first_name: document.getElementById('edit-firstname').value.trim(),
    last_name: document.getElementById('edit-lastname').value.trim(),
    phone: document.getElementById('edit-phone').value.trim(),
    asso_type: document.getElementById('edit-asso-type').value
  };
  if (!updates.first_name || !updates.last_name) {
    showToast('Le prénom et le nom sont obligatoires.', 'warning');
    return;
  }

  const { error } = await updateAdminAccount(id, updates);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  closeModal('edit-admin-modal');
  await loadAdmins();
  showToast('Compte admin mis à jour (nom, initiales, contact).', 'success');
}

async function setCustomPassword() {
  if (!currentAdminId) { showToast('Ouvrez d\'abord le compte admin concerné.', 'warning'); return; }
  const input = document.getElementById('custom-pwd');
  const pwd = (input.value || '').trim();
  if (pwd.length < 6) {
    showToast('Le mot de passe doit contenir au moins 6 caractères.', 'warning');
    return;
  }

  const { error } = await updateAdminAccount(currentAdminId, { password: pwd });
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  input.value = '';
  const box = document.getElementById('temp-pwd-box');
  box.textContent = '✔ Mot de passe personnalisé défini pour ce compte.';
  box.style.display = 'block';
  showToast('Mot de passe mis à jour.', 'success');
}

// ==========================================
// Create admin (validé directement par le Super Admin)
// ==========================================

async function createAdmin(e) {
  e.preventDefault();

  const email = document.getElementById('new-email').value.trim().toLowerCase();
  const firstName = document.getElementById('new-firstname').value.trim();
  const lastName = document.getElementById('new-lastname').value.trim();
  const phone = document.getElementById('new-phone').value.trim();
  const assoType = document.getElementById('new-asso-type').value;

  if (isSuperAdminEmail(email)) {
    showToast('Cette email est réservée au Super Admin.', 'warning');
    return;
  }

  const pwd = 'TRIPA-' + Math.random().toString(36).slice(2, 10);

  const { error } = await createAdminAccount({
    email, password: pwd,
    first_name: firstName, last_name: lastName, phone,
    asso_type: assoType, status: 'active'
  });
  if (error) {
    showToast('Erreur: ' + error.message, 'danger');
    return;
  }

  closeModal('create-admin-modal');
  await loadAdmins();
  showToast(`Admin créé et activé. Mot de passe temporaire : ${pwd}`, 'success', 8000);
}
