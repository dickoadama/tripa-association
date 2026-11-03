/* TRIPA — Auth (login / register) en mode statique 100 % local.
 * Le formulaire de « connexion » est en réalité un déverrouillage par code
 * d'accès local (hash SHA-256 stocké dans localStorage). Le formulaire
 * d'inscription définit ce code et renseigne le profil de l'association.
 *
 * Aucun email, aucun rôle distant, aucune validation Super Admin :
 *   - Si aucun code n'est défini, index.html redirige vers register.html.
 *   - Si un code existe déjà, register.html redirige vers index.html.
 */
document.addEventListener('DOMContentLoaded', () => {
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

  /* ---- « Code oublié » : instructions de reset DevTools ---- */
  const forgot = document.getElementById('forgot');
  if (forgot) forgot.addEventListener('click', e => {
    e.preventDefault();
    showAlert('ok', 'Réinitialiser : ouvrez DevTools (F12) → Console, tapez localStorage.removeItem("tripa_key") puis rechargez. Vos données restent dans le navigateur.');
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

  /* ---- Aiguillage : première visite vs visite suivante ---- */
  const isLogin = !!document.getElementById('login-form');
  const isRegister = !!document.getElementById('register-form');
  if (isLogin && !API.hasKey()) { location.href = 'register.html'; return; }
  if (isRegister && API.hasKey()) { location.href = 'index.html'; return; }

  /* ---- Déverrouillage ---- */
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', async e => {
    e.preventDefault(); clearInvalid(); hideAlert();
    const password = document.getElementById('password').value;
    if (!password) { invalid('password', 'Code requis.'); return; }
    const btn = loginForm.querySelector('button[type=submit]');
    loading(btn, true);
    await handleLogin(null, password, (k, m) => { loading(btn, false); showAlert(k, m); });
  });

  /* ---- Définition du code d'accès + profil ---- */
  const registerForm = document.getElementById('register-form');
  if (registerForm) registerForm.addEventListener('submit', async e => {
    e.preventDefault(); clearInvalid(); hideAlert();
    const pwd = document.getElementById('password').value;
    const confirmPwd = document.getElementById('confirm-password').value;
    let ok = true;
    if (pwd.length < 4) { invalid('password', '4 caractères minimum.'); ok = false; }
    if (pwd !== confirmPwd) { invalid('confirm-password', 'Les codes ne correspondent pas.'); ok = false; }
    if (!ok) return;
    const btn = registerForm.querySelector('button[type=submit]');
    loading(btn, true);
    await handleRegister({
      password: pwd,
      nom: (document.getElementById('lastname')?.value || '').trim(),
      prenom: (document.getElementById('firstname')?.value || '').trim(),
      email: (document.getElementById('email')?.value || '').trim().toLowerCase(),
      telephone: (document.getElementById('phone')?.value || '').trim(),
      asso_type: document.getElementById('asso-type')?.value || ''
    }, (k, m) => { loading(btn, false); showAlert(k, m); });
  });
});

/* ---------- Handlers ---------- */
async function handleLogin(_email, password, feedback) {
  feedback = feedback || ((k, m) => alert(m));
  const { data, error } = await API.loginUser(null, password);
  if (error) { feedback('error', error.message || 'Échec de déverrouillage.'); return; }
  if (!data || !(data.user || data.profile)) { feedback('error', 'Aucun compte trouvé.'); return; }
  const back = new URLSearchParams(location.search).get('next') || 'dashboard.html';
  window.location.href = back;
}

async function handleRegister(payload, feedback) {
  feedback = feedback || ((k, m) => alert(m));
  const { error } = await API.registerUser({ password: payload.password });
  if (error) { feedback('error', error.message || 'Échec de la définition du code.'); return; }
  if (payload.nom || payload.prenom || payload.email || payload.telephone || payload.asso_type) {
    await API.updateOwnProfile({
      nom: payload.nom, prenom: payload.prenom,
      email: payload.email, telephone: payload.telephone,
      asso_type: payload.asso_type
    });
  }
  feedback('ok', 'Code défini. Ouverture du tableau de bord…');
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
}
