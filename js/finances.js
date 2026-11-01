/* ==========================================
   TRIPA — Finances (finances.js)
   CRUD des recettes/dépenses via l'API TRIPA
   (backend Express + SQLite), cloisonnées par admin.
   ========================================== */

let TRANSACTIONS = [];
let CURRENT_PROFILE = null;

const FINANCE_CATEGORIES = ['Cotisation', 'Dons', 'Subvention', 'Événement', 'Fonctionnement', 'Salaires', 'Autre'];

function escF(str) {
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

  document.getElementById('financeForm').addEventListener('submit', addTransaction);
  document.getElementById('searchInput').addEventListener('input', renderTransactions);
  document.getElementById('typeFilter').addEventListener('change', renderTransactions);

  await loadTransactions();
});

async function loadTransactions() {
  const { data, error } = await fetchAll('finances', {
    order: { column: 'date', ascending: false }
  });
  if (error) { showToast('Erreur chargement: ' + error.message, 'danger'); TRANSACTIONS = []; }
  else TRANSACTIONS = data || [];

  renderTransactions();
}

function renderTransactions() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('typeFilter').value;

  // Stats globales (non filtrées)
  let revenus = 0, depenses = 0;
  TRANSACTIONS.forEach(t => { if (t.type === 'revenu') revenus += Number(t.amount); else depenses += Number(t.amount); });
  document.getElementById('statRevenus').textContent = formatCurrency(revenus);
  document.getElementById('statDepenses').textContent = formatCurrency(depenses);
  document.getElementById('statSolde').textContent = formatCurrency(revenus - depenses);

  let list = TRANSACTIONS;
  if (typeFilter) list = list.filter(t => t.type === typeFilter);
  if (search) list = list.filter(t =>
    (t.description || '').toLowerCase().includes(search) ||
    (t.category || '').toLowerCase().includes(search)
  );

  const tbody = document.getElementById('financeTbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i data-lucide="wallet" style="width:32px;height:32px;"></i><p>Aucune transaction</p></div></td></tr>';
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = list.map(t => {
    const isIn = t.type === 'revenu';
    return `
      <tr>
        <td>${escF(t.description)}</td>
        <td>${escF(t.category || '—')}</td>
        <td><span class="badge badge--${isIn ? 'success' : 'danger'}">${isIn ? 'Recette' : 'Dépense'}</span></td>
        <td style="color: var(--${isIn ? 'success' : 'danger'}); font-weight:600;">${isIn ? '+' : '−'}${formatCurrency(t.amount)}</td>
        <td>${t.date ? formatDate(t.date) : '—'}</td>
        <td><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="removeTransaction('${t.id}')" title="Supprimer"><i data-lucide="trash-2" class="icon-sm"></i></button></td>
      </tr>`;
  }).join('');
  lucide.createIcons();
}

async function addTransaction(e) {
  e.preventDefault();

  const tx = {
    type: document.getElementById('txType').value,
    category: document.getElementById('txCategory').value,
    description: document.getElementById('txDescription').value.trim(),
    amount: Number(document.getElementById('txAmount').value),
    date: document.getElementById('txDate').value || new Date().toISOString().slice(0, 10)
  };

  if (!tx.description) { showToast('La description est obligatoire.', 'warning'); return; }
  if (!(tx.amount > 0)) { showToast('Le montant doit être supérieur à 0.', 'warning'); return; }

  const { data, error } = await insertRow('finances', tx);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }
  TRANSACTIONS.unshift(data);

  document.getElementById('financeForm').reset();
  closeModal('addPaymentModal');
  renderTransactions();
  showToast('Transaction enregistrée.', 'success');
}

async function removeTransaction(id) {
  if (!confirm('Supprimer cette transaction ?')) return;
  const { error } = await deleteRow('finances', id);
  if (error) { showToast('Erreur: ' + error.message, 'danger'); return; }

  TRANSACTIONS = TRANSACTIONS.filter(x => x.id !== id);
  renderTransactions();
  showToast('Transaction supprimée.', 'success');
}
