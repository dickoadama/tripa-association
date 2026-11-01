/* ==========================================
   TRIPA — Réunions (meetings.js)
   CRUD des réunions, rattachées à l'admin connecté.
   ========================================== */

let MEETINGS = [];
let CURRENT_PROFILE = null;

const MEETING_STATUS = {
  planifiee: { label: 'Planifiée', color: 'warning' },
  terminee:  { label: 'Terminée',  color: 'success' },
  annulee:   { label: 'Annulée',   color: 'danger' }
};

const MEETING_CATEGORY_COLORS = {
  'AG': 'primary', 'CA': 'secondary', 'Bureau': 'info', 'ordinaire': 'ghost'
};

function escMtg(str) {
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

  document.getElementById('meetingForm').addEventListener('submit', addMeeting);
  document.getElementById('searchInput').addEventListener('input', renderMeetings);
  document.getElementById('categoryFilter').addEventListener('change', renderMeetings);

  await loadMeetings();
});

async function loadMeetings() {
  const { data, error } = await fetchAll('meetings', {
    order: { column: 'start_at', ascending: true }
  });
  if (error) { showToast('Erreur chargement: ' + error.message, 'danger'); MEETINGS = []; }
  else MEETINGS = data || [];

  renderMeetings();
}

function renderMeetings() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const cat = document.getElementById('categoryFilter').value;

  let list = MEETINGS;
  if (cat) list = list.filter(m => m.category === cat);
  if (search) list = list.filter(m => (m.title || '').toLowerCase().includes(search));

  document.getElementById('meetingsCount').textContent = `${MEETINGS.length} réunion${MEETINGS.length > 1 ? 's' : ''}`;

  const grid = document.getElementById('meetingsGrid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i data-lucide="calendar-x" style="width:32px;height:32px;"></i><p>Aucune réunion</p></div>';
    lucide.createIcons();
    return;
  }

  grid.innerHTML = list.map(m => {
    const s = MEETING_STATUS[m.status] || MEETING_STATUS.planifiee;
    const catColor = MEETING_CATEGORY_COLORS[m.category] || 'ghost';
    return `
      <div class="meeting-card card">
        <div class="card__header flex justify-between items-start border-b pb-4 mb-4">
          <div>
            <span class="badge badge--${catColor} mb-2 inline-block">${escMtg(m.category || '—')}</span>
            <h3 class="text-lg font-bold">${escMtg(m.title)}</h3>
          </div>
          <span class="badge badge--${s.color}">${s.label}</span>
        </div>
        <div class="card__body flex flex-col gap-3">
          <div class="flex items-center gap-3 text-muted"><i data-lucide="calendar"></i> ${m.start_at ? formatDateTime(m.start_at) : '—'}</div>
          <div class="flex items-center gap-3 text-muted"><i data-lucide="map-pin"></i> ${escMtg(m.location || '—')}</div>
          ${m.description ? `<div class="text-sm">${escMtg(m.description)}</div>` : ''}
        </div>
        <div class="card__footer pt-4 mt-4 border-t flex justify-end">
          <button class="btn btn--ghost btn--sm text-danger" onclick="removeMeeting('${m.id}')"><i data-lucide="trash-2" class="icon-sm"></i> Supprimer</button>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

async function addMeeting(e) {
  e.preventDefault();

  const startVal = document.getElementById('mtStart').value;
  const meeting = {
    title: document.getElementById('mtTitle').value.trim(),
    category: document.getElementById('mtCategory').value,
    location: document.getElementById('mtLocation').value.trim(),
    description: document.getElementById('mtAgenda').value.trim(),
    start_at: startVal ? new Date(startVal).toISOString() : new Date().toISOString(),
    attendees: 0,
    status: 'planifiee'
  };

  if (!meeting.title) { showToast('Le titre est obligatoire.', 'warning'); return; }

  const { data, error } = await insertRow('meetings', meeting);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }
  MEETINGS.push(data);

  document.getElementById('meetingForm').reset();
  closeModal('addMeetingModal');
  MEETINGS.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  renderMeetings();
  showToast('Réunion créée.', 'success');
}

async function removeMeeting(id) {
  if (!confirm('Supprimer cette réunion ?')) return;
  const { error } = await deleteRow('meetings', id);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  MEETINGS = MEETINGS.filter(x => x.id !== id);
  renderMeetings();
  showToast('Réunion supprimée.', 'success');
}
