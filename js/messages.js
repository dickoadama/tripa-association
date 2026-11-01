/* ==========================================
   TRIPA — Messagerie (messages.js)
   Gestion des messages, rattachés à l'admin connecté.
   ========================================== */

let MESSAGES = [];
let CURRENT_PROFILE = null;
let SELECTED_MSG_ID = null;

function escMg(str) {
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

  document.getElementById('newMessageForm').addEventListener('submit', addMessage);
  document.getElementById('searchInput').addEventListener('input', renderMessages);
  document.getElementById('readFilter').addEventListener('change', renderMessages);

  await loadMessages();
});

async function loadMessages() {
  const { data, error } = await fetchAll('messages', {
    order: { column: 'created_at', ascending: false }
  });
  if (error) { showToast('Erreur chargement: ' + error.message, 'danger'); MESSAGES = []; }
  else MESSAGES = data || [];

  renderMessages();
}

function renderMessages() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const readFilter = document.getElementById('readFilter').value;

  let list = MESSAGES;
  if (readFilter === 'non lus') list = list.filter(m => !m.is_read);
  if (search) list = list.filter(m =>
    (m.sender || '').toLowerCase().includes(search) ||
    (m.subject || '').toLowerCase().includes(search) ||
    (m.body || '').toLowerCase().includes(search)
  );

  const unread = MESSAGES.filter(m => !m.is_read).length;
  document.getElementById('messagesCount').textContent =
    `${MESSAGES.length} message${MESSAGES.length > 1 ? 's' : ''}` +
    (unread ? ` · ${unread} non lu${unread > 1 ? 's' : ''}` : '');

  const container = document.getElementById('messagesList');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state" style="padding:24px;text-align:center;"><p>Aucun message</p></div>';
    return;
  }

  container.innerHTML = list.map(m => {
    const active = m.id === SELECTED_MSG_ID ? ' active' : '';
    const dot = m.is_read ? '' : '<span class="badge badge--dot badge--primary"></span>';
    return `
      <div class="chat-item${active}" onclick="selectMessage('${m.id}')">
        <div class="avatar avatar--sm" style="background:var(--color-accent-secondary)">${escMg((m.sender || '?').slice(0, 2).toUpperCase())}</div>
        <div class="chat-item-content">
          <div class="chat-item-header">
            <span class="chat-item-name">${dot} ${escMg(m.sender || '—')}</span>
            <span class="chat-item-time">${m.created_at ? timeAgo(m.created_at) : ''}</span>
          </div>
          <div class="chat-item-msg">${escMg(m.subject || m.body || '')}</div>
        </div>
      </div>`;
  }).join('');

  renderDetail();
}

function renderDetail() {
  const detail = document.getElementById('messageDetail');
  const m = MESSAGES.find(x => x.id === SELECTED_MSG_ID);
  if (!m) {
    detail.innerHTML = '<div class="empty-state" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;"><i data-lucide="message-square" style="width:32px;height:32px;"></i><p>Sélectionnez un message</p></div>';
    lucide.createIcons();
    return;
  }

  detail.innerHTML = `
    <div class="card__header flex justify-between items-center">
      <div>
        <h3 class="font-600 text-sm">${escMg(m.subject || '(sans objet)')}</h3>
        <p class="text-xs text-muted">De : ${escMg(m.sender || '—')} · ${m.created_at ? formatDate(m.created_at) : ''}</p>
      </div>
      <span class="badge badge--${m.is_read ? 'ghost' : 'primary'}">${m.is_read ? 'Lu' : 'Non lu'}</span>
    </div>
    <div class="chat-messages"><div class="msg-bubble msg-in">${escMg(m.body || '')}</div></div>
    <div class="chat-input-area flex justify-between items-center">
      <div class="flex gap-2">
        <button class="btn btn--ghost btn--sm" onclick="markRead('${m.id}', ${m.is_read ? 'false' : 'true'})"><i data-lucide="${m.is_read ? 'mail' : 'check-check'}" class="icon-sm"></i> ${m.is_read ? 'Marquer non lu' : 'Marquer lu'}</button>
      </div>
      <button class="btn btn--ghost btn--sm text-danger" onclick="deleteMessage('${m.id}')"><i data-lucide="trash-2" class="icon-sm"></i> Supprimer</button>
    </div>`;
  lucide.createIcons();
}

function selectMessage(id) {
  SELECTED_MSG_ID = id;
  renderMessages();
}

async function persistMsgUpdate(id, updates) {
  const { error } = await updateRow('messages', id, updates);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return false; }
  const local = MESSAGES.find(x => x.id === id);
  if (local) Object.assign(local, updates);
  return true;
}

async function addMessage(e) {
  e.preventDefault();

  const msg = {
    sender: document.getElementById('msgSender').value.trim(),
    subject: document.getElementById('msgSubject').value.trim(),
    body: document.getElementById('msgBody').value.trim(),
    is_read: false
  };

  if (!msg.sender || !msg.body) { showToast('L\'expéditeur et le message sont obligatoires.', 'warning'); return; }

  const { data: created, error } = await insertRow('messages', msg);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  MESSAGES.unshift(created);
  SELECTED_MSG_ID = created.id;
  document.getElementById('newMessageForm').reset();
  closeModal('newMessageModal');
  renderMessages();
  showToast('Message reçu.', 'success');
}

async function markRead(id, val) {
  if (await persistMsgUpdate(id, { is_read: !!val })) renderMessages();
}

async function deleteMessage(id) {
  if (!confirm('Supprimer ce message ?')) return;
  const { error } = await deleteRow('messages', id);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  MESSAGES = MESSAGES.filter(x => x.id !== id);
  if (SELECTED_MSG_ID === id) SELECTED_MSG_ID = null;
  renderMessages();
  showToast('Message supprimé.', 'success');
}
