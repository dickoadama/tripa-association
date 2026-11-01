/* ==========================================
   TRIPA — Événements (events.js)
   CRUD des événements, rattachés à l'admin connecté.
   ========================================== */

let EVENTS = [];
let CURRENT_PROFILE = null;

const EVENT_ICONS = ['party-popper', 'book-open', 'users', 'heart', 'music', 'sun'];

function escEv(str) {
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

  document.getElementById('eventForm').addEventListener('submit', addEvent);
  document.getElementById('searchInput').addEventListener('input', renderEvents);
  document.getElementById('dateFilter').addEventListener('change', renderEvents);

  await loadEvents();
});

async function loadEvents() {
  const { data, error } = await fetchAll('events', {
    order: { column: 'event_date', ascending: true }
  });
  if (error) { showToast('Erreur chargement: ' + error.message, 'danger'); EVENTS = []; }
  else EVENTS = data || [];

  renderEvents();
}

function renderEvents() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const dateFilter = document.getElementById('dateFilter').value;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let list = EVENTS;
  if (dateFilter === 'avenir') list = list.filter(e => new Date(e.event_date) >= today);
  else if (dateFilter === 'passes') list = list.filter(e => new Date(e.event_date) < today);
  if (search) list = list.filter(e =>
    (e.title || '').toLowerCase().includes(search) ||
    (e.location || '').toLowerCase().includes(search)
  );

  document.getElementById('eventsCount').textContent = `${EVENTS.length} événement${EVENTS.length > 1 ? 's' : ''}`;

  const grid = document.getElementById('eventsGrid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i data-lucide="calendar-x" style="width:32px;height:32px;"></i><p>Aucun événement</p></div>';
    lucide.createIcons();
    return;
  }

  grid.innerHTML = list.map((ev, i) => {
    const icon = EVENT_ICONS[i % EVENT_ICONS.length];
    const when = ev.event_date ? formatDate(ev.event_date) + (ev.event_time ? ' - ' + ev.event_time : '') : '—';
    return `
      <div class="card">
        <div style="height:120px; background:linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));" class="flex items-center justify-center">
          <i data-lucide="${icon}" style="width:48px; height:48px; color:white;"></i>
        </div>
        <div class="card__body">
          <div class="flex justify-between items-start mb-2">
            <h3>${escEv(ev.title)}</h3>
            ${ev.status === 'termine' ? '<span class="badge badge--ghost">Passé</span>' : '<span class="badge badge--success">À venir</span>'}
          </div>
          <div class="flex items-center gap-2 text-sm text-muted mb-1"><i data-lucide="calendar" class="icon-sm"></i><span>${when}</span></div>
          <div class="flex items-center gap-2 text-sm text-muted mb-4"><i data-lucide="map-pin" class="icon-sm"></i><span>${escEv(ev.location || '—')}</span></div>
          ${ev.description ? `<p class="text-sm mb-4">${escEv(ev.description)}</p>` : ''}
          <div class="flex gap-2">
            <button class="btn btn--ghost btn--sm text-danger flex-1" onclick="removeEvent('${ev.id}')"><i data-lucide="trash-2" class="icon-sm"></i> Supprimer</button>
          </div>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

async function addEvent(e) {
  e.preventDefault();

  const ev = {
    title: document.getElementById('evTitle').value.trim(),
    event_date: document.getElementById('evDate').value,
    event_time: document.getElementById('evTime').value || null,
    location: document.getElementById('evLocation').value.trim(),
    description: document.getElementById('evDescription').value.trim(),
    status: 'planifie'
  };

  if (!ev.title || !ev.event_date) { showToast('Le titre et la date sont obligatoires.', 'warning'); return; }

  const { data, error } = await insertRow('events', ev);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }
  EVENTS.push(data);

  document.getElementById('eventForm').reset();
  closeModal('addEventModal');
  EVENTS.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  renderEvents();
  showToast('Événement créé.', 'success');
}

async function removeEvent(id) {
  if (!confirm('Supprimer cet événement ?')) return;
  const { error } = await deleteRow('events', id);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  EVENTS = EVENTS.filter(x => x.id !== id);
  renderEvents();
  showToast('Événement supprimé.', 'success');
}
