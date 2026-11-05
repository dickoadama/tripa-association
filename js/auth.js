/* TRIPA — Auth : page de connexion (index.html) et inscription (register.html).
 * Comptes Supabase Auth (email + mot de passe). Rôles :
 *   - super_admin : forcé par trigger SQL sur le PREMIER inscrit ;
 *   - admin / user : créés uniquement via un lien d'invitation (?invite=token).
 * Après connexion/inscription, routage par rôle :
 *   super_admin → admin-management.html, sinon dashboard.html (ou ?next=).
 */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  /* ---- Sélecteur de thème (clair → sombre → auto) ---- */
  const themeBtn = document.getElementById('themeBtn');
  const themeIconName = (t) => t === 'dark' ? 'moon' : (t === 'auto' ? 'monitor' : 'sun');
  function paintThemeIcon() {
    if (!themeBtn || !window.TRIPA) return;
    themeBtn.innerHTML = '<i data-lucide="' + themeIconName(TRIPA.PREFS.get().theme) + '"></i>';
    if (window.lucide) lucide.createIcons(themeBtn);
  }
  if (themeBtn) { themeBtn.addEventListener('click', () => { TRIPA.PREFS.cycleTheme(); paintThemeIcon(); }); paintThemeIcon(); }

  /* ---- Bascule de visibilité des mots de passe ---- */
  document.querySelectorAll('.pw-toggle').forEach(btn => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = '<i data-lucide="' + (show ? 'eye-off' : 'eye') + '"></i>';
    if (window.lucide) lucide.createIcons(btn);
    input.focus();
  }));

  /* ---- Outils de feedback ---- */
  const alertEl = document.getElementById('alert'), alertMsg = document.getElementById('alertMsg');
  function showAlert(kind, msg) {
    if (!alertEl) { alert(msg); return; }
    alertMsg.textContent = msg;
    alertEl.className = 'auth__alert show auth__alert--' + (kind === 'ok' ? 'ok' : 'error');
    const old = alertEl.querySelector('svg,i'); if (old) old.remove();
    const ic = document.createElement('i'); ic.setAttribute('data-lucide', kind === 'ok' ? 'check-circle' : 'alert-circle');
    alertEl.insertBefore(ic, alertEl.firstChild);
    if (window.lucide) lucide.createIcons(alertEl);
  }
  function hideAlert() { if (alertEl) alertEl.className = 'auth__alert'; }
  function invalid(id, msg) {
    const f = document.querySelector('.field[data-field="' + id + '"]');
    if (!f) return; f.classList.add('is-invalid');
    const m = f.querySelector('.field__msg'); if (m) m.textContent = msg;
  }
  function clearInvalid() { document.querySelectorAll('.field.is-invalid').forEach(f => f.classList.remove('is-invalid')); }
  function loading(btn, on) { if (btn) { btn.classList.toggle('is-loading', on); btn.disabled = on; } }
  function lockForm(on) {
    const form = document.getElementById('register-form');
    if (form) form.querySelector('button[type=submit]').disabled = !!on;
  }

  const isLogin = !!document.getElementById('login-form');
  const isRegister = !!document.getElementById('register-form');

  /* ---- Déjà connecté → bonne page selon le rôle ---- */
  if (await API.redirectIfAuthed()) return;

  /* ---- Jauge de robustesse (register) ---- */
  const pw = document.getElementById('password'), strength = document.getElementById('strength');
  if (pw && strength && isRegister) {
    const fill = strength.querySelector('.strength__fill'), lbl = strength.querySelector('.strength__label');
    strength.hidden = false;
    pw.addEventListener('input', () => {
      const v = pw.value; let s = 0;
      if (v.length >= 6) s++;
      if (v.length >= 10) s++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
      if (/[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
      const map = [['0%', 'var(--border-strong)', 'Trop court'], ['25%', 'var(--danger)', 'Faible'], ['50%', 'var(--warning)', 'Moyen'], ['75%', 'var(--info)', 'Bon'], ['100%', 'var(--success)', 'Excellent']];
      const [w, c, t] = map[v ? Math.max(1, s) : 0];
      fill.style.width = w; fill.style.background = c; lbl.textContent = v ? t : 'Trop court';
    });
  }

  /* ================= CONNEXION ================= */
  if (isLogin) {
    // Lien « créer le Super Admin » visible uniquement tant qu'aucun compte n'existe.
    const firstRow = document.getElementById('first-admin-row');
    if (firstRow) {
      const superExists = await API.hasSuperAdmin();
      if (!superExists) firstRow.hidden = false;
    }

    const forgot = document.getElementById('forgot');
    if (forgot) forgot.addEventListener('click', async e => {
      e.preventDefault(); hideAlert(); clearInvalid();
      const email = (document.getElementById('email')?.value || '').trim();
      if (!email) { invalid('email', 'Saisissez d’abord votre email.'); return; }
      const { error } = await API.recoverPassword(email);
      if (error) { showAlert('error', 'Erreur : ' + error.message); return; }
      showAlert('ok', 'Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé.');
    });

    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', async e => {
      e.preventDefault(); clearInvalid(); hideAlert();
      const email = (document.getElementById('email').value || '').trim();
      const password = document.getElementById('password').value;
      let ok = true;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { invalid('email', 'Email invalide.'); ok = false; }
      if (!password) { invalid('password', 'Mot de passe requis.'); ok = false; }
      if (!ok) return;
      const btn = loginForm.querySelector('button[type=submit]');
      loading(btn, true);
      await handleLogin(email, password, (k, m) => { loading(btn, false); showAlert(k, m); });
    });
    return;
  }

  /* ================= INSCRIPTION ================= */
  if (!isRegister) return;

  let mode = 'invited';           // 'super' = création du Super Admin (premier inscrit), 'invited' = via lien, 'blocked'
  let invitation = null;
  const token = new URLSearchParams(location.search).get('invite');
  const eyebrow = document.getElementById('reg-eyebrow');
  const title = document.getElementById('reg-title');
  const sub = document.getElementById('reg-sub');
  const banner = document.getElementById('invite-banner');
  const badge = document.getElementById('invite-badge');

  if (token) {
    const { data } = await API.fetchInvitation(token);
    if (!data) {
      mode = 'blocked';
      showAlert('error', 'Lien d’invitation invalide ou déjà utilisé. Demandez un nouveau lien à votre administrateur.');
      lockForm(true);
    } else {
      invitation = data;
    }
  } else {
    const superExists = await API.hasSuperAdmin();
    if (!superExists) {
      mode = 'super';
      if (eyebrow) eyebrow.textContent = 'Premier lancement';
      if (title) title.textContent = 'Créer le compte Super Admin';
      if (sub) sub.textContent = 'Vous serez le compte unique administrateur de la plateforme : création des administrateurs et gestion des comptes.';
    } else {
      mode = 'blocked';
      showAlert('error', 'L’inscription se fait uniquement via un lien d’invitation reçu d’un administrateur. Déjà inscrit ? Connectez-vous.');
      lockForm(true);
    }
  }

  if (invitation) {
    const roleLabel = invitation.role === 'admin' ? 'Administrateur' : 'Utilisateur';
    if (eyebrow) eyebrow.textContent = 'Invitation ' + roleLabel;
    if (title) title.textContent = 'Activer mon compte ' + roleLabel;
    if (sub) sub.textContent = 'Votre invitation a été vérifiée. Complétez pour rejoindre l’association.';
    if (banner) banner.hidden = false;
    if (badge) { badge.textContent = '🎟️ Invitation ' + roleLabel + ' — email vérifié'; badge.className = 'badge badge--success'; }
    const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    set('email', invitation.email); set('firstname', invitation.prenom);
    set('lastname', invitation.nom); set('phone', invitation.telephone);
    set('asso-type', invitation.asso_type);
    const emailEl = document.getElementById('email');
    if (emailEl) { emailEl.readOnly = true; emailEl.style.opacity = '.7'; }
    ['firstname', 'lastname', 'phone', 'asso-type'].forEach(id => {
      const el = document.getElementById(id); if (el) el.disabled = true;
    });
  }

  const registerForm = document.getElementById('register-form');
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (mode === 'blocked') return;
    clearInvalid(); hideAlert();
    const email = (document.getElementById('email').value || '').trim().toLowerCase();
    const pwd = document.getElementById('password').value;
    const confirmPwd = document.getElementById('confirm-password').value;
    let ok = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { invalid('email', 'Email invalide.'); ok = false; }
    if (pwd.length < 6) { invalid('password', '6 caractères minimum.'); ok = false; }
    if (pwd !== confirmPwd) { invalid('confirm-password', 'Les mots de passe ne correspondent pas.'); ok = false; }
    if (!ok) return;
    const val = id => (document.getElementById(id)?.value || '').trim();
    const btn = registerForm.querySelector('button[type=submit]');
    loading(btn, true);
    await handleRegister({
      email, password: pwd,
      prenom: mode === 'super' ? val('firstname') : (invitation.prenom || val('firstname')),
      nom: mode === 'super' ? val('lastname') : (invitation.nom || val('lastname')),
      telephone: mode === 'super' ? val('phone') : (invitation.telephone || val('phone')),
      asso_type: mode === 'super' ? val('asso-type') : (invitation.asso_type || val('asso-type')),
      mode
    }, (k, m) => { loading(btn, false); showAlert(k, m); });
  });
});

/* ---------- Handlers ---------- */
async function handleLogin(email, password, feedback) {
  feedback = feedback || ((k, m) => alert(m));
  const { data, error } = await API.loginUser(email, password);
  if (error) { feedback('error', error.message || 'Échec de la connexion.'); return; }
  const prof = data.profile;
  if (prof.status !== 'active') {
    const msg = prof.status === 'suspended' ? 'Compte suspendu — contactez le Super Admin.'
              : prof.status === 'revoked'   ? 'Compte révoqué — contactez le Super Admin.'
              : 'Compte en attente de validation.';
    await API.logoutUser();
    feedback('error', msg);
    return;
  }
  if (prof.role === 'super_admin') { window.location.href = 'admin-management.html'; return; }
  const back = new URLSearchParams(location.search).get('next') || 'dashboard.html';
  window.location.href = back;
}

async function handleRegister(payload, feedback) {
  feedback = feedback || ((k, m) => alert(m));
  const { data, error } = await API.registerUser(payload);
  if (error) { feedback('error', error.message || 'Échec de l\'inscription.'); return; }
  const role = (data && data.profile && data.profile.role) || (payload.mode === 'super' ? 'super_admin' : 'user');
  feedback('ok', 'Compte créé avec succès (' + role + '). Redirection…');
  setTimeout(() => {
    window.location.href = role === 'super_admin' ? 'admin-management.html' : 'dashboard.html';
  }, 1200);
}
