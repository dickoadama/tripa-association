/* ==========================================
   TRIPA — Documents (documents.js)
   Registre documentaire, rattaché à l'admin connecté.
   ========================================== */

let DOCUMENTS = [];
let CURRENT_PROFILE = null;
let ACTIVE_FOLDER = '';

const DOC_CATEGORIES = ['Statuts & Règlements', 'Bilans Financiers', 'PV de Réunions', 'Photos Événements', 'Autre'];

const FORMAT_GROUPS = {
  pdf: ['pdf'],
  doc: ['doc', 'docx', 'odt', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'],
  img: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
};

const FORMAT_ICONS = {
  pdf: { icon: 'file-text', color: 'var(--color-danger)' },
  img: { icon: 'image', color: 'var(--color-success)' },
  doc: { icon: 'file', color: 'var(--color-info)' },
  other: { icon: 'file', color: 'var(--color-text-muted)' }
};

function escD(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function fileFormat(name) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  for (const g of Object.keys(FORMAT_GROUPS)) {
    if (FORMAT_GROUPS[g].includes(ext)) return g;
  }
  return 'other';
}

function formatIcon(fmt) { return FORMAT_ICONS[fmt] || FORMAT_ICONS.other; }

function humanSize(bytes) {
  if (!bytes || bytes <= 0) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return (i === 0 ? n : n.toFixed(1)) + ' ' + units[i];
}

document.addEventListener('DOMContentLoaded', async () => {
  CURRENT_PROFILE = await requireAuth(['active']);
  if (!CURRENT_PROFILE) return;

  initModals();
  initSidebar();
  initHeader(CURRENT_PROFILE);

  document.getElementById('docForm').addEventListener('submit', addDocument);
  document.getElementById('searchInput').addEventListener('input', renderDocuments);
  document.getElementById('formatFilter').addEventListener('change', renderDocuments);

  await loadDocuments();
});

async function loadDocuments() {
  const { data, error } = await fetchAll('documents', {
    order: { column: 'created_at', ascending: false }
  });
  if (error) { showToast('Erreur chargement: ' + error.message, 'danger'); DOCUMENTS = []; }
  else DOCUMENTS = data || [];

  renderDocuments();
}

function selectFolder(cat) {
  ACTIVE_FOLDER = (ACTIVE_FOLDER === cat) ? '' : cat;
  renderDocuments();
}

function renderFolders() {
  const grid = document.getElementById('foldersGrid');
  const cats = DOC_CATEGORIES.filter(c => c !== 'Autre').concat('Autre');
  grid.innerHTML = cats.map(cat => {
    const count = DOCUMENTS.filter(d => (d.category || 'Autre') === cat).length;
    const active = ACTIVE_FOLDER === cat ? 'outline:2px solid var(--color-accent-primary);' : '';
    return `
      <div class="card p-4 flex flex-col items-center justify-center text-center cursor-pointer" style="transition:0.2s;${active}" onclick="selectFolder('${escD(cat)}')">
        <i data-lucide="folder" style="width:48px; height:48px; color:var(--color-accent-primary); margin-bottom:12px;"></i>
        <span class="font-600">${escD(cat)}</span>
        <span class="text-xs text-muted">${count} fichier${count > 1 ? 's' : ''}</span>
      </div>`;
  }).join('');
}

function renderDocuments() {
  renderFolders();

  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const fmt = document.getElementById('formatFilter').value;

  let list = DOCUMENTS;
  if (ACTIVE_FOLDER) list = list.filter(d => (d.category || 'Autre') === ACTIVE_FOLDER);
  if (fmt) list = list.filter(d => fileFormat(d.name) === fmt);
  if (search) list = list.filter(d => (d.name || '').toLowerCase().includes(search));

  document.getElementById('docsCount').textContent =
    `${DOCUMENTS.length} document${DOCUMENTS.length > 1 ? 's' : ''}`;

  const tbody = document.getElementById('docsTbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;">Aucun document</td></tr>';
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = list.map(d => {
    const fmtKey = fileFormat(d.name);
    const fi = formatIcon(fmtKey);
    const fmtLabel = fmtKey === 'img' ? 'Image' : fmtKey === 'doc' ? 'Doc' : fmtKey.toUpperCase();
    const dl = d.storage_path
      ? `<a class="btn btn--icon btn--ghost btn--sm" href="${escD(d.storage_path)}" target="_blank" rel="noopener"><i data-lucide="download"></i></a>`
      : `<button class="btn btn--icon btn--ghost btn--sm" onclick="showToast('Aperçu indisponible (métadonnée).','info')"><i data-lucide="download"></i></button>`;
    return `
      <tr>
        <td class="flex items-center gap-3">
          <i data-lucide="${fi.icon}" style="color:${fi.color}"></i>
          <span>${escD(d.name)}</span>
        </td>
        <td>${fmtLabel}</td>
        <td>${escD(d.size_label || '—')}</td>
        <td>${d.created_at ? formatDate(d.created_at) : '—'}</td>
        <td>
          <div class="flex gap-2">
            ${dl}
            <button class="btn btn--icon btn--ghost btn--sm text-danger" onclick="removeDocument('${d.id}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
  lucide.createIcons();
}

async function addDocument(e) {
  e.preventDefault();

  const name = document.getElementById('docName').value.trim();
  const category = document.getElementById('docCategory').value;
  const fileInput = document.getElementById('docFile');
  const file = fileInput.files && fileInput.files[0];

  const doc = {
    name: name || (file ? file.name : ''),
    category,
    size_label: file ? humanSize(file.size) : '—',
    storage_path: ''
  };

  if (!doc.name) { showToast('Le nom du document est obligatoire.', 'warning'); return; }

  const { data: created, error } = await insertRow('documents', doc);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  DOCUMENTS.unshift(created);
  document.getElementById('docForm').reset();
  closeModal('addDocModal');
  renderDocuments();
  showToast('Document ajouté.', 'success');
}

async function removeDocument(id) {
  if (!confirm('Supprimer ce document ?')) return;
  const { error } = await deleteRow('documents', id);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  DOCUMENTS = DOCUMENTS.filter(x => x.id !== id);
  renderDocuments();
  showToast('Document supprimé.', 'success');
}
