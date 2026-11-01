/* ==========================================
   TRIPA — Votes (votes.js)
   CRUD des votes en assemblée, rattachés à l'admin connecté.
   ========================================== */

let VOTES = [];
let CURRENT_PROFILE = null;

const VOTE_STATUS = {
  ouvert: { label: 'En cours', color: 'warning' },
  ferme: { label: 'Terminé', color: 'success' },
  annule: { label: 'Annulé', color: 'danger' }
};

function escV(str) {
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

  document.getElementById('voteForm').addEventListener('submit', addVote);
  document.getElementById('searchInput').addEventListener('input', renderVotes);
  document.getElementById('statusFilter').addEventListener('change', renderVotes);
  document.getElementById('addOptionBtn').addEventListener('click', () => addOptionRow());

  resetOptionsContainer();
  await loadVotes();
});

async function loadVotes() {
  const { data, error } = await fetchAll('votes', {
    order: { column: 'created_at', ascending: false }
  });
  if (error) { showToast('Erreur chargement: ' + error.message, 'danger'); VOTES = []; }
  else VOTES = data || [];

  renderVotes();
}

function totalVotes(v) {
  const r = v.results || {};
  return Object.values(r).reduce((s, n) => s + (Number(n) || 0), 0);
}

function renderVotes() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const status = document.getElementById('statusFilter').value;

  let list = VOTES;
  if (status) list = list.filter(v => v.status === status);
  if (search) list = list.filter(v => (v.question || '').toLowerCase().includes(search));

  document.getElementById('votesCount').textContent =
    `${VOTES.length} vote${VOTES.length > 1 ? 's' : ''}`;

  const grid = document.getElementById('votesGrid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i data-lucide="vote" style="width:32px;height:32px;"></i><p>Aucun vote</p></div>';
    lucide.createIcons();
    return;
  }

  grid.innerHTML = list.map(v => {
    const st = VOTE_STATUS[v.status] || VOTE_STATUS.ouvert;
    const total = totalVotes(v);
    const options = Array.isArray(v.options) ? v.options : [];
    const results = v.results || {};
    const bars = options.map(opt => {
      const n = Number(results[opt]) || 0;
      const pct = total ? Math.round((n / total) * 100) : 0;
      const inc = v.status === 'ouvert'
        ? `<button class="btn btn--ghost btn--sm" onclick="countVote('${v.id}', '${encodeURIComponent(opt)}')" title="Ajouter un vote"><i data-lucide="plus" class="icon-sm"></i></button>`
        : '';
      return `
        <div class="vote-result-item">
          <div class="vote-stat">
            <span>${escV(opt)}</span>
            <span class="flex items-center gap-2"><span>${n} (${pct}%)</span>${inc}</span>
          </div>
          <div class="progress-bar-container"><div class="progress-bar" style="width:${pct}%;"></div></div>
        </div>`;
    }).join('');

    const closeBtn = v.status === 'ouvert'
      ? `<button class="btn btn--ghost btn--sm" onclick="closeVote('${v.id}')"><i data-lucide="check" class="icon-sm"></i> Clôturer</button>`
      : `<button class="btn btn--ghost btn--sm" onclick="reopenVote('${v.id}')"><i data-lucide="rotate-ccw" class="icon-sm"></i> Rouvrir</button>`;

    return `
      <div class="card vote-card">
        <div class="card__header flex justify-between items-center">
          <span class="badge badge--${st.color} badge--dot">${st.label}</span>
          <span class="text-muted text-sm"><i data-lucide="clock" class="icon-sm"></i> ${total} votant${total > 1 ? 's' : ''}</span>
        </div>
        <div class="card__body">
          <h3>${escV(v.question)}</h3>
          ${v.description ? `<p class="text-muted" style="margin:1rem 0;">${escV(v.description)}</p>` : ''}
          <div class="vote-results">${bars}</div>
        </div>
        <div class="card__footer flex justify-between items-center" style="margin-top:1.5rem;">
          ${closeBtn}
          <button class="btn btn--ghost btn--sm text-danger" onclick="removeVote('${v.id}')"><i data-lucide="trash-2" class="icon-sm"></i> Supprimer</button>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

function addOptionRow(value = '') {
  const wrap = document.getElementById('optionsContainer');
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2';
  row.innerHTML = `
    <input type="text" class="form-input option-input" placeholder="Ex: Pour" value="${escV(value)}">
    <button type="button" class="btn btn--ghost text-danger" onclick="this.parentElement.remove()"><i data-lucide="trash-2"></i></button>`;
  wrap.appendChild(row);
  lucide.createIcons();
}

async function persistVoteUpdate(id, updates) {
  const { error } = await updateRow('votes', id, updates);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return false; }
  const local = VOTES.find(x => x.id === id);
  if (local) Object.assign(local, updates);
  return true;
}

async function addVote(e) {
  e.preventDefault();

  const question = document.getElementById('voteQuestion').value.trim();
  const description = document.getElementById('voteDescription').value.trim();
  const closesAt = document.getElementById('voteClosesAt').value;
  const options = Array.from(document.querySelectorAll('#optionsContainer .option-input'))
    .map(i => i.value.trim()).filter(Boolean);

  if (!question) { showToast('Le sujet du vote est obligatoire.', 'warning'); return; }
  if (options.length < 2) { showToast('Ajoutez au moins deux options.', 'warning'); return; }

  const vote = {
    question, description, options,
    results: {},
    closes_at: closesAt || null,
    status: 'ouvert'
  };

  const { data: created, error } = await insertRow('votes', vote);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  VOTES.unshift(created);
  document.getElementById('voteForm').reset();
  resetOptionsContainer();
  closeModal('createVoteModal');
  renderVotes();
  showToast('Vote créé.', 'success');
}

function resetOptionsContainer() {
  const wrap = document.getElementById('optionsContainer');
  wrap.innerHTML = '';
  addOptionRow('Pour');
  addOptionRow('Contre');
  addOptionRow('Abstention');
}

async function countVote(id, encodedOpt) {
  const opt = decodeURIComponent(encodedOpt);
  const v = VOTES.find(x => x.id === id);
  if (!v) return;
  const results = { ...(v.results || {}) };
  results[opt] = (Number(results[opt]) || 0) + 1;
  if (await persistVoteUpdate(id, { results })) renderVotes();
}

async function closeVote(id) {
  if (await persistVoteUpdate(id, { status: 'ferme' })) { showToast('Vote clôturé.', 'success'); renderVotes(); }
}

async function reopenVote(id) {
  if (await persistVoteUpdate(id, { status: 'ouvert' })) { showToast('Vote rouvert.', 'success'); renderVotes(); }
}

async function removeVote(id) {
  if (!confirm('Supprimer ce vote ?')) return;
  const { error } = await deleteRow('votes', id);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  VOTES = VOTES.filter(x => x.id !== id);
  renderVotes();
  showToast('Vote supprimé.', 'success');
}
