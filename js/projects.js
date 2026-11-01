/* ==========================================
   TRIPA — Projets & Tâches (projects.js)
   Tableau Kanban, rattaché à l'admin connecté.
   ========================================== */

let PROJECTS = [];
let CURRENT_PROFILE = null;

const PROJECT_COLUMNS = [
  { key: 'a_faire',  label: 'À faire',     color: 'var(--color-text-muted)',    badge: 'ghost' },
  { key: 'en_cours', label: 'En cours',    color: 'var(--color-accent-primary)', badge: 'primary' },
  { key: 'termine',  label: 'Terminé',     color: 'var(--color-success)',        badge: 'success' },
  { key: 'en_panne', label: 'En attente',  color: 'var(--color-danger)',         badge: 'danger' }
];

function escP(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

document.addEventListener('DOMContentLoaded', async () => {
  CURRENT_PROFILE = await requireAuth(['active']);
  if (!CURRENT_PROFILE) return;

  initModals();
  initSidebar();
  initHeader(CURRENT_PROFILE);

  document.getElementById('projectForm').addEventListener('submit', addProject);
  document.getElementById('searchInput').addEventListener('input', renderProjects);

  await loadProjects();
});

async function loadProjects() {
  const { data, error } = await fetchAll('projects', {
    order: { column: 'created_at', ascending: false }
  });
  if (error) { showToast('Erreur chargement: ' + error.message, 'danger'); PROJECTS = []; }
  else PROJECTS = data || [];

  renderProjects();
}

function renderProjects() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const board = document.getElementById('kanbanBoard');

  board.innerHTML = PROJECT_COLUMNS.map(col => {
    let items = PROJECTS.filter(p => (p.status || 'a_faire') === col.key);
    if (search) items = items.filter(p => (p.title || '').toLowerCase().includes(search));
    const cards = items.map(p => cardHtml(p, col)).join('');
    return `
      <div class="kanban-col">
        <div class="kanban-header">
          <span class="flex items-center gap-2"><div style="width:10px;height:10px;border-radius:50%;background:${col.color}"></div>${col.label}</span>
          <span class="badge badge--${col.badge}">${items.length}</span>
        </div>
        <div class="kanban-cards">${cards || '<p class="text-xs text-muted" style="padding:8px 0;">Vide</p>'}</div>
      </div>`;
  }).join('');

  document.getElementById('projectsCount').textContent =
    `${PROJECTS.length} tâche${PROJECTS.length > 1 ? 's' : ''}`;

  lucide.createIcons();
}

function cardHtml(p, col) {
  const idx = PROJECT_COLUMNS.findIndex(c => c.key === col.key);
  const prev = idx > 0 ? PROJECT_COLUMNS[idx - 1] : null;
  const next = idx < PROJECT_COLUMNS.length - 1 ? PROJECT_COLUMNS[idx + 1] : null;
  const done = p.status === 'termine';
  const overdue = p.due_date && !done && new Date(p.due_date) < new Date();

  const moveBtns = `
    <div class="flex gap-1">
      ${prev ? `<button class="btn btn--icon btn--ghost btn--sm" title="Déplacer vers ${prev.label}" onclick="moveProject('${p.id}', -1)"><i data-lucide="chevron-left" class="icon-sm"></i></button>` : ''}
      ${next ? `<button class="btn btn--icon btn--ghost btn--sm" title="Déplacer vers ${next.label}" onclick="moveProject('${p.id}', 1)"><i data-lucide="chevron-right" class="icon-sm"></i></button>` : ''}
    </div>`;

  return `
    <div class="kanban-card" style="${done ? 'opacity:0.75' : ''}">
      <div class="flex justify-between items-start mb-2">
        <h4 class="mb-0" style="${done ? 'text-decoration:line-through;' : ''}">${escP(p.title)}</h4>
        <button class="btn btn--icon btn--ghost btn--sm text-danger" onclick="removeProject('${p.id}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
      </div>
      ${p.description ? `<p class="text-xs text-muted mb-3">${escP(p.description)}</p>` : ''}
      ${typeof p.progress === 'number' && p.progress > 0 && p.status !== 'termine' ? `
        <div class="flex items-center gap-2 mb-3">
          <div class="progress" style="flex:1"><div class="progress__bar" style="width:${p.progress}%"></div></div>
          <span class="text-xs text-muted">${p.progress}%</span>
        </div>` : ''}
      <div class="flex items-center justify-between text-xs ${overdue ? 'text-danger' : 'text-muted'} mt-3">
        <div class="flex items-center gap-1"><i data-lucide="calendar" class="icon-sm"></i> ${p.due_date ? formatDate(p.due_date) : '—'}</div>
        ${moveBtns}
      </div>
    </div>`;
}

async function persistProjectUpdate(id, updates) {
  const { error } = await updateRow('projects', id, updates);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return false; }
  const local = PROJECTS.find(x => x.id === id);
  if (local) Object.assign(local, updates);
  return true;
}

async function addProject(e) {
  e.preventDefault();

  const project = {
    title: document.getElementById('projTitle').value.trim(),
    description: document.getElementById('projDescription').value.trim(),
    status: document.getElementById('projStatus').value,
    progress: Number(document.getElementById('projProgress').value) || 0,
    due_date: document.getElementById('projDue').value || null
  };

  if (!project.title) { showToast('Le titre est obligatoire.', 'warning'); return; }

  const { data: created, error } = await insertRow('projects', project);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  PROJECTS.unshift(created);
  document.getElementById('projectForm').reset();
  closeModal('addTaskModal');
  renderProjects();
  showToast('Tâche créée.', 'success');
}

async function moveProject(id, dir) {
  const p = PROJECTS.find(x => x.id === id);
  if (!p) return;
  const idx = PROJECT_COLUMNS.findIndex(c => c.key === (p.status || 'a_faire'));
  const target = PROJECT_COLUMNS[idx + dir];
  if (!target) return;

  const updates = { status: target.key };
  if (target.key === 'termine') updates.progress = 100;
  else if (target.key === 'a_faire') updates.progress = 0;

  if (await persistProjectUpdate(id, updates)) renderProjects();
}

async function removeProject(id) {
  if (!confirm('Supprimer cette tâche ?')) return;
  const { error } = await deleteRow('projects', id);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  PROJECTS = PROJECTS.filter(x => x.id !== id);
  renderProjects();
  showToast('Tâche supprimée.', 'success');
}
