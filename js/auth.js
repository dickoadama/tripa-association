/* TRIPA — Auth (login / register) : nouveau modèle d'interaction.
 * Feedback en ligne (plus d'alert()), bascule de visibilité du mot de passe,
 * jauge de robustesse, état de chargement, sélecteur de thème. */
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  /* ---- Sélecteur de thème (clair → sombre → auto) ---- */
  const themeBtn = document.getElementById('themeBtn');
  const themeIconName = (t) => t === 'dark' ? 'moon' : (t === 'auto' ? 'monitor' : 'sun');
  function paintThemeIcon() {
    if (!themeBtn || !window.TRIPA) return;
    const name = themeIconName(TRIPA.PREFS.get().theme);
    themeBtn.innerHTML = '<i data-lucide="' + name + '"></i>';
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
  function clearInvalid() {
    document.querySelectorAll('.field.is-invalid').forEach(f => f.classList.remove('is-invalid'));
  }
  function loading(btn, on) { if (btn) btn.classList.toggle('is-loading', on); if (btn) btn.disabled = on; }

  /* ---- Mot de passe oublié (démo) ---- */
  const forgot = document.getElementById('forgot');
  if (forgot) forgot.addEventListener('click', e => {
    e.preventDefault();
    showAlert('ok', 'Réinitialisation non disponible en auto-hébergement : contactez votre Super Admin.');
  });

  /* ---- Jauge de robustesse (register) ---- */
  const pw = document.getElementById('password'), strength = document.getElementById('strength');
  if (pw && strength && document.getElementById('register-form')) {
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

  /* ---- Connexion ---- */
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', async e => {
    e.preventDefault(); clearInvalid(); hideAlert();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    let ok = true;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { invalid('email', 'Adresse email invalide.'); ok = false; }
    if (!password) { invalid('password', 'Mot de passe requis.'); ok = false; }
    if (!ok) return;
    const btn = loginForm.querySelector('button[type=submit]');
    loading(btn, true);
    const remember = document.getElementById('remember')?.checked || false;
    await handleLogin(email, password, (k, m) => { loading(btn, false); showAlert(k, m); }, remember);
  });

  /* ---- Inscription ---- */
  const registerForm = document.getElementById('register-form');
  if (registerForm) registerForm.addEventListener('submit', async e => {
    e.preventDefault(); clearInvalid(); hideAlert();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const pwd = document.getElementById('password').value;
    const confirmPwd = document.getElementById('confirm-password').value;
    let ok = true;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { invalid('email', 'Adresse email invalide.'); ok = false; }
    if (pwd.length < 6) { invalid('password', '6 caractères minimum.'); ok = false; }
    if (pwd !== confirmPwd) { invalid('confirm-password', 'Les mots de passe ne correspondent pas.'); ok = false; }
    if (isSuperAdminEmail(email)) { showAlert('error', 'Cette adresse est réservée au Super Admin.'); ok = false; }
    if (!ok) return;
    const btn = registerForm.querySelector('button[type=submit]');
    loading(btn, true);
    await handleRegister({
      email, password: pwd,
      nom: (document.getElementById('lastname')?.value || '').trim(),
      prenom: (document.getElementById('firstname')?.value || '').trim(),
      telephone: (document.getElementById('phone')?.value || '').trim(),
      asso_type: document.getElementById('asso-type')?.value || ''
    }, (k, m) => { loading(btn, false); showAlert(k, m); });
  });
});

async function handleLogin(email, password, feedback, remember) {
  feedback = feedback || ((k, m) => alert(m));
  const { data, error } = await loginUser(email, password, remember);
  if (error) { feedback('error', 'Connexion impossible : ' + error.message); return; }
  const profile = data && data.profile;
  if (!profile) { feedback('error', 'Aucun compte trouvé.'); return; }
  if (profile.role === 'super_admin') { setSessionToken(data.token); saveSessionProfile(profile); window.location.href = 'admin-management.html'; return; }
  if (profile.status === 'pending') { feedback('error', 'Compte en attente de validation par le Super Admin.'); return; }
  if (profile.status === 'suspended') { feedback('error', 'Votre compte a été suspendu.'); return; }
  if (profile.status === 'rejected') { feedback('error', 'Votre inscription a été rejetée.'); return; }
  setSessionToken(data.token); saveSessionProfile(profile); window.location.href = 'dashboard.html';
}

async function handleRegister(payload, feedback) {
  feedback = feedback || ((k, m) => alert(m));
  const { error } = await registerUser(payload);
  if (error) { feedback('error', 'Inscription impossible : ' + error.message); return; }
  feedback('ok', 'Compte créé ! En attente de validation par le Super Admin…');
  setTimeout(() => { window.location.href = 'index.html'; }, 1700);
}
