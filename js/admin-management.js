/* TRIPA — Console Super Admin : gestion des comptes administrateurs.
 * Le Super Admin (compte unique, premier inscrit) crée des admins via des
 * liens d'invitation, suspend / réactive / révoque les comptes, et consulte
 * les utilisateurs rattachés à chaque admin. Il ne touche aucune donnée métier.
 * La suppression d'un compte auth n'est pas possible depuis le navigateur
 * (clé de service requise) : « Supprimer » = révocation définitive.
 */
let SUPER_PROFILE = null;
let SUPER_ADMINS = [], SUPER_USERS = [], SUPER_INVITES = [];

document.addEventListener('DOMContentLoaded', async () => {
  const profile = await requireAuth(['active'], ['super_admin']);
  if (!profile) return;
  SUPER_PROFILE = profile;
  buildLayout('super', 'Console Super Admin');
  await reloadConsole();
});

async function reloadConsole() {
  const [admins, users, invites] = await Promise.all([listAdmins(), listUsers(), listInvitations()]);
  SUPER_ADMINS = admins.data || [];
  SUPER_USERS = users.data || [];
  SUPER_INVITES = (invites.data || []).filter(i => i.role === 'admin');
  renderConsole();
}

function renderConsole() {
  const content = document.getElementById('content');
  const activeCount = SUPER_ADMINS.filter(a => a.status === 'active').length;
  const userCount = SUPER_USERS.length;
  content.innerHTML = `
    <div class="grid grid--3 mb-6 no-print">
      <div class="card card__body"><div class="row" style="gap:12px;"><i data-lucide="shield-check" style="color:var(--accent)"></i>
        <div><div class="stat__num" style="font-size:26px;font-weight:600;" data-count="${activeCount}">0</div><div class="muted">Administrateurs actifs</div></div></div></div>
      <div class="card card__body"><div class="row" style="gap:12px;"><i data-lucide="users" style="color:var(--accent)"></i>
        <div><div class="stat__num" style="font-size:26px;font-weight:600;" data-count="${userCount}">0</div><div class="muted">Utilisateurs invités</div></div></div></div>
      <div class="card card__body"><div class="row" style="gap:12px;"><i data-lucide="mail-plus" style="color:var(--accent)"></i>
        <div><div class="stat__num" style="font-size:26px;font-weight:600;" data-count="${SUPER_INVITES.length}">0</div><div class="muted">Invitations admin en attente</div></div></div></div>
    </div>

    <div class="card mt-4" id="inviteAdminCard">
      <div class="card__header"><h3><i data-lucide="user-plus"></i> Créer un administrateur</h3></div>
      <div class="card__body">
        <div class="form-grid">
          <div class="field"><label class="label">Email <span class="req">*</span></label>
            <input class="input" type="email" id="inv-email" placeholder="admin@exemple.com"></div>
          <div class="field"><label class="label">Prénom</label><input class="input" id="inv-prenom"></div>
          <div class="field"><label class="label">Nom</label><input class="input" id="inv-nom"></div>
          <div class="field"><label class="label">Téléphone</label><input class="input" id="inv-tel"></div>
        </div>
        <button class="btn btn--primary" id="genInvite"><i data-lucide="link"></i> Générer un lien d'invitation</button>
        <div id="inviteOut" class="mt-4"></div>
      </div>
    </div>

    ${invitesSection()}
    ${adminsSection()}
    ${usersSection()}`;

  wireConsole();
  if (window.lucide) lucide.createIcons();
  attachRipple && attachRipple(content);
}

function invitesSection() {
  if (!SUPER_INVITES.length) return '';
  return `<div class="card mt-4">
    <div class="card__header"><h3><i data-lucide="hourglass"></i> Invitations administrateur non utilisées</h3></div>
    <div class="table-wrap"><table class="table"><thead><tr>
      <th>Email</th><th>Nom</th><th>Lien d'inscription</th><th>Créée le</th><th style="text-align:right;">Actions</th>
    </tr></thead><tbody>` +
    SUPER_INVITES.map(i => `<tr>
      <td data-col="email"><b>${esc(i.email)}</b></td>
      <td data-col="nom">${esc([i.prenom, i.nom].filter(Boolean).join(' ') || '—')}</td>
      <td data-col="link"><code style="font-size:12px;word-break:break-all;">${esc(invitationLink(i.token))}</code></td>
      <td data-col="date">${formatDate(i.created_at)}</td>
      <td style="text-align:right;white-space:nowrap;">
        <button class="btn btn--ghost btn--sm" data-copy="${esc(i.token)}"><i data-lucide="copy"></i> Copier</button>
        <a class="btn btn--ghost btn--sm" href="${mailtoLink(i)}"><i data-lucide="mail"></i> Envoyer</a>
        <button class="btn btn--danger btn--sm" data-del-inv="${esc(i.token)}"><i data-lucide="trash-2"></i></button>
      </td></tr>`).join('') +
    `</tbody></table></div></div>`;
}

function adminsSection() {
  const rows = SUPER_ADMINS.map(a => {
    const nbUsers = SUPER_USERS.filter(u => u.admin_id === a.id).length;
    return `<tr>
      <td data-col="email"><b>${esc(a.email)}</b></td>
      <td data-col="nom">${esc([a.prenom, a.nom].filter(Boolean).join(' ') || '—')}</td>
      <td data-col="asso">${esc(humanize(a.asso_type || '')) || '—'}</td>
      <td data-col="statut">${badge(a.status)}</td>
      <td data-col="users">${nbUsers}</td>
      <td data-col="date">${formatDate(a.created_at)}</td>
      <td style="text-align:right;white-space:nowrap;">${statusActions(a)}</td></tr>`;
  }).join('');
  return `<div class="card mt-4">
    <div class="card__header"><h3><i data-lucide="shield"></i> Administrateurs (${SUPER_ADMINS.length})</h3></div>
    <div class="table-wrap"><table class="table"><thead><tr>
      <th>Email</th><th>Nom</th><th>Association</th><th>Statut</th><th>Utilisateurs</th><th>Créé le</th><th style="text-align:right;">Actions</th>
    </tr></thead><tbody>${rows || '<tr><td colspan="7"><div class="empty">Aucun administrateur. Générez un lien d’invitation ci-dessus.</div></td></tr>'}</tbody></table></div>
    <p class="muted" style="padding:0 16px 12px;font-size:13px;">ℹ️ « Révoquer » désactive définitivement le compte (la suppression du compte cloud n'est pas possible depuis un navigateur).</p></div>`;
}

function usersSection() {
  const adminMail = id => (SUPER_ADMINS.find(a => a.id === id) || {}).email || '—';
  const rows = SUPER_USERS.map(u => `<tr>
      <td data-col="email"><b>${esc(u.email)}</b></td>
      <td data-col="nom">${esc([u.prenom, u.nom].filter(Boolean).join(' ') || '—')}</td>
      <td data-col="admin">${esc(adminMail(u.admin_id))}</td>
      <td data-col="statut">${badge(u.status)}</td>
      <td data-col="date">${formatDate(u.created_at)}</td>
      <td style="text-align:right;white-space:nowrap;">${statusActions(u)}</td></tr>`).join('');
  return `<div class="card mt-4">
    <div class="card__header"><h3><i data-lucide="users"></i> Utilisateurs (${SUPER_USERS.length})</h3></div>
    <div class="table-wrap"><table class="table"><thead><tr>
      <th>Email</th><th>Nom</th><th>Admin rattaché</th><th>Statut</th><th>Créé le</th><th style="text-align:right;">Actions</th>
    </tr></thead><tbody>${rows || '<tr><td colspan="6"><div class="empty">Aucun utilisateur invité pour l’instant.</div></td></tr>'}</tbody></table></div></div>`;
}

function statusActions(p) {
  if (p.status === 'active')
    return `<button class="btn btn--ghost btn--sm" data-status="${esc(p.row_id)}|suspended"><i data-lucide="pause-circle"></i> Suspendre</button>
      <button class="btn btn--danger btn--sm" data-status="${esc(p.row_id)}|revoked"><i data-lucide="ban"></i> Révoquer</button>`;
  if (p.status === 'suspended')
    return `<button class="btn btn--ghost btn--sm" data-status="${esc(p.row_id)}|active"><i data-lucide="play-circle"></i> Réactiver</button>
      <button class="btn btn--danger btn--sm" data-status="${esc(p.row_id)}|revoked"><i data-lucide="ban"></i> Révoquer</button>`;
  return '<span class="muted">Compte révoqué</span>';
}

function mailtoLink(i) {
  const subject = encodeURIComponent('Invitation TRIPA — créez votre compte');
  const body = encodeURIComponent('Vous avez été invité(e) à rejoindre TRIPA.\nActivez votre compte avec ce lien :\n\n' + invitationLink(i.token));
  return 'mailto:' + encodeURIComponent(i.email) + '?subject=' + subject + '&body=' + body;
}

function copyText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText)
    return navigator.clipboard.writeText(txt).then(() => true).catch(() => fallbackCopy(txt));
  return Promise.resolve(fallbackCopy(txt));
}
function fallbackCopy(txt) {
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
  ta.remove(); return ok;
}

function wireConsole() {
  const gen = document.getElementById('genInvite');
  if (gen) gen.addEventListener('click', async () => {
    const email = (document.getElementById('inv-email').value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email invalide.', 'danger'); return; }
    gen.disabled = true;
    const { data, error } = await createInvitation({
      email, role: 'admin',
      prenom: (document.getElementById('inv-prenom').value || '').trim(),
      nom: (document.getElementById('inv-nom').value || '').trim(),
      telephone: (document.getElementById('inv-tel').value || '').trim()
    });
    gen.disabled = false;
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    const link = invitationLink(data.token);
    document.getElementById('inviteOut').innerHTML = `
      <div class="auth__alert show auth__alert--ok" style="position:static;">
        <span>Invitation créée pour <b>${esc(email)}</b>. Transmettez ce lien :</span><br>
        <code style="font-size:12px;word-break:break-all;display:inline-block;margin-top:6px;">${esc(link)}</code><br>
        <button class="btn btn--ghost btn--sm mt-2" data-copy="${esc(data.token)}"><i data-lucide="copy"></i> Copier le lien</button>
        <a class="btn btn--ghost btn--sm mt-2" href="${mailtoLink(data)}"><i data-lucide="mail"></i> Envoyer par email</a>
      </div>`;
    if (window.lucide) lucide.createIcons();
    bindCopyButtons();
    await reloadConsole();
  });

  document.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', async () => {
    const [rowId, status] = b.dataset.status.split('|');
    if (status === 'revoked' && !confirm('Révoquer définitivement ce compte ? L\'utilisateur ne pourra plus se connecter.')) return;
    const { error } = await setProfileStatus(rowId, status);
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    showToast('Statut mis à jour : ' + humanize(status) + '.', 'success');
    await reloadConsole();
  }));

  document.querySelectorAll('[data-del-inv]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Supprimer cette invitation ? Le lien ne fonctionnera plus.')) return;
    const { error } = await deleteInvitation(b.dataset.delInv);
    if (error) { showToast('Erreur : ' + error.message, 'danger'); return; }
    showToast('Invitation supprimée.', 'success');
    await reloadConsole();
  }));

  bindCopyButtons();
}

function bindCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach(b => {
    if (b.dataset.wired) return; b.dataset.wired = '1';
    b.addEventListener('click', async () => {
      const ok = await copyText(invitationLink(b.dataset.copy));
      showToast(ok ? 'Lien copié dans le presse-papiers.' : 'Copie impossible — sélectionnez le lien manuellement.', ok ? 'success' : 'warning');
    });
  });
}
