/* ==========================================
   TRIPA — Gestion des Membres (members.js)
   CRUD complet via l'API TRIPA (backend Express + SQLite).
   Chaque admin ne voit que les membres de SON association
   (cloisonnement appliqué par le serveur via admin_id).
   ========================================== */

let MEMBERS = [];
let CURRENT_PROFILE = null;

const MEMBER_AVATAR_COLORS = ['var(--primary)', 'var(--success)', 'var(--info)', 'var(--secondary)', 'var(--gray-500)'];

// Échappement des valeurs utilisateur avant injection HTML
function escM(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// ==========================================
// Init
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  CURRENT_PROFILE = await requireAuth(['active']);
  if (!CURRENT_PROFILE) return;

  initModals();
  initSidebar();
  initHeader(CURRENT_PROFILE);

  populateRoleSelects();
  document.getElementById('memberForm').addEventListener('submit', addMember);
  document.getElementById('customRoleForm').addEventListener('submit', createCustomRole);
  document.getElementById('searchInput').addEventListener('input', renderMembers);
  document.getElementById('roleFilter').addEventListener('change', renderMembers);
  document.getElementById('statusFilter').addEventListener('change', renderMembers);

  await loadMembers();
});

// ==========================================
// Rôles (standard + personnalisés)
// ==========================================

// Remplit le filtre et le select du formulaire à partir de getRoles()
function populateRoleSelects() {
  const roles = getRoles();
  const options = Object.entries(roles)
    .map(([key, r]) => `<option value="${key}">${escM(r.label)}</option>`)
    .join('');

  const filter = document.getElementById('roleFilter');
  const formRole = document.getElementById('memberRole');
  if (filter) filter.innerHTML = `<option value="">Tous les rôles</option>${options}`;
  if (formRole) formRole.innerHTML = options;
}

async function createCustomRole(e) {
  e.preventDefault();
  const label = document.getElementById('customRoleLabel').value.trim();
  const color = document.getElementById('customRoleColor').value;

  const res = addCustomRole(label, color);
  if (res.error) { showToast(res.error, 'warning'); return; }

  document.getElementById('customRoleForm').reset();
  closeModal('createRoleModal');
  populateRoleSelects();
  const formRole = document.getElementById('memberRole');
  if (formRole) formRole.value = res.key;
  showToast(`Rôle « ${label} » créé et sélectionné.`, 'success');
}

// ==========================================
// Data loading
// ==========================================

async function loadMembers() {
  const { data, error } = await fetchAll('members', {
    order: { column: 'created_at', ascending: false }
  });
  if (error) {
    showToast('Erreur chargement: ' + error.message, 'danger');
    MEMBERS = [];
  } else {
    MEMBERS = data || [];
  }

  renderMembers();
}

// ==========================================
// Rendering
// ==========================================

function renderMembers() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const roleFilter = document.getElementById('roleFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;

  let list = MEMBERS;
  if (roleFilter) list = list.filter(m => m.role === roleFilter);
  if (statusFilter) list = list.filter(m => m.status === statusFilter);
  if (search) list = list.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search) ||
    (m.email || '').toLowerCase().includes(search) ||
    (m.phone || '').toLowerCase().includes(search)
  );

  document.getElementById('membersCount').textContent =
    `${MEMBERS.length} membre${MEMBERS.length > 1 ? 's' : ''} au total`;

  const grid = document.getElementById('membersGrid');
  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i data-lucide="user-round-search" style="width:32px;height:32px;"></i>
        <p>Aucun membre trouvé</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = list.map((m, i) => {
    const initials = escM(((m.first_name || '?')[0] + (m.last_name || '')).toUpperCase());
    const color = MEMBER_AVATAR_COLORS[i % MEMBER_AVATAR_COLORS.length];
    return `
      <div class="card member-card">
        <div class="card__body flex flex-col items-center text-center gap-3">
          <div class="avatar avatar--lg" style="background-color: ${color};">
            <span class="avatar__initials">${initials}</span>
          </div>
          <div>
            <h3 class="member-name font-600">${escM(m.first_name)} ${escM(m.last_name)}</h3>
            ${getRoleBadge(m.role)}
          </div>
          <div class="flex flex-col gap-2 w-full mt-2 text-sm text-muted">
            ${m.email ? `<div class="flex items-center gap-2 justify-center">
              <i data-lucide="mail" class="icon-sm"></i><span>${escM(m.email)}</span>
            </div>` : ''}
            ${m.phone ? `<div class="flex items-center gap-2 justify-center">
              <i data-lucide="phone" class="icon-sm"></i><span>${escM(m.phone)}</span>
            </div>` : ''}
          </div>
          <div class="flex items-center gap-2 mt-2">
            ${getStatusBadge(m.status)}
            <button class="btn btn--ghost btn--icon" onclick="removeMember('${m.id}')" title="Supprimer">
              <i data-lucide="trash-2" class="icon-sm"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

// ==========================================
// Create / Delete
// ==========================================

async function addMember(e) {
  e.preventDefault();

  const member = {
    first_name: document.getElementById('memberFirstname').value.trim(),
    last_name: document.getElementById('memberLastname').value.trim(),
    email: document.getElementById('memberEmail').value.trim().toLowerCase(),
    phone: document.getElementById('memberPhone').value.trim(),
    role: document.getElementById('memberRole').value,
    status: document.getElementById('memberStatus').value
  };

  if (!member.first_name || !member.last_name) {
    showToast('Le prénom et le nom sont obligatoires.', 'warning');
    return;
  }

  const { data, error } = await insertRow('members', member);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }
  MEMBERS.unshift(data);

  document.getElementById('memberForm').reset();
  closeModal('addMemberModal');
  renderMembers();
  showToast(`Membre « ${member.first_name} ${member.last_name} » ajouté.`, 'success');
}

async function removeMember(memberId) {
  const m = MEMBERS.find(x => x.id === memberId);
  if (!m) return;
  if (!confirm(`Supprimer ${m.first_name} ${m.last_name} de vos membres ?`)) return;

  const { error } = await deleteRow('members', memberId);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  MEMBERS = MEMBERS.filter(x => x.id !== memberId);
  renderMembers();
  showToast('Membre supprimé.', 'success');
}
