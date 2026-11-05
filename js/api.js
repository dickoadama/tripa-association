'use strict';
/* TRIPA — Couche données & auth : Supabase (GoTrue Auth + PostgREST) via fetch direct.
 * Aucun SDK, aucune CDN : uniquement les endpoints REST du projet.
 * Signatures asynchrones compatibles avec les modules (entity.js, utils.js,
 * settings.js, profile.js, activity.js, auth.js, admin-management.js, dashboard inline).
 *
 * Rôles : super_admin (unique, premier inscrit — forcé par trigger SQL),
 *         admin (invité par le Super Admin), user (invité par un admin, accès limité).
 * Cloisonnement des données par RLS (owner_id = admin). Schéma : supabase-schema.sql.
 *
 * localStorage : tripa_session (JWT), tripa_profile_cache (profil courant),
 *                tripa_prefs (préférences). L'ancien schéma 100 % local est
 *                purgé au chargement (demande d'effacement total des données).
 */
const API = (() => {

  const SUPABASE_URL = 'https://ldfjbjwtqcikcfsjotgt.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_yY6ioruyspMCBTOFxLJN4w_bYk2i8Em'; // clé publique (publishable) — protégée par RLS
  const PFX = 'tripa_';
  const KEYS_ENTITIES = ['adherents','cotisations','evenements','activites','communications','achats','documents','taches'];

  /* ---------- localStorage (session + cache uniquement) ---------- */
  function rawGet(k, def) {
    try { const s = localStorage.getItem(PFX + k); return s === null ? def : JSON.parse(s); }
    catch (_) { return def; }
  }
  function rawSet(k, v) {
    try { localStorage.setItem(PFX + k, JSON.stringify(v)); return true; }
    catch (_) { appCmd('Stockage local saturé.', 'err'); return false; }
  }
  function rawDel(k) { try { localStorage.removeItem(PFX + k); } catch (_) {} }

  /* Purge one-shot de l'architecture « 100 % locale » (données abandonnées). */
  (function purgeLegacyLocalData() {
    ['key', 'unlocked', 'profile', 'activity'].forEach(rawDel);
    try {
      Object.keys(localStorage).filter(k => k.indexOf(PFX + 'data_') === 0)
        .forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  })();

  const genId = () => (self.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : ('id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  const nowIso = () => new Date().toISOString();

  /* ---------- Toast ---------- */
  function appCmd(msg, type) {
    if (window.TRIPA && TRIPA.toast) { TRIPA.toast(msg, type || 'info'); return; }
    let t = document.getElementById('app-cmd-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'app-cmd-toast';
      t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:10px 18px;background:#111;color:#fff;border-radius:8px;z-index:9999;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:80vw';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._hide); t._hide = setTimeout(() => { t.style.display = 'none'; }, 3200);
  }

  /* ---------- Session ---------- */
  function getSession() { return rawGet('session', null); }
  function setSession(s) { rawSet('session', s); }
  function clearSession() { rawDel('session'); rawDel('profile_cache'); }

  async function refreshSession() {
    const s = getSession();
    if (!s || !s.refresh_token) return false;
    try {
      const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', cache: 'no-store',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!r.ok) return false;
      const j = await r.json();
      setSession({ access_token: j.access_token, refresh_token: j.refresh_token,
                   user: { id: j.user.id, email: j.user.email } });
      return true;
    } catch (_) { return false; }
  }

  /* Appel REST générique : {data, error, status}. 401 → un refresh puis rejet. */
  async function sbFetch(path, opts) {
    opts = opts || {};
    const s = getSession();
    const headers = Object.assign({ apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, opts.headers || {});
    headers.Authorization = 'Bearer ' + ((s && s.access_token) || SUPABASE_ANON_KEY);
    if (opts.prefer) headers.Prefer = opts.prefer;
    let res;
    try {
      res = await fetch(SUPABASE_URL + path, {
        method: opts.method || 'GET', cache: 'no-store', headers,
        body: opts.body != null ? JSON.stringify(opts.body) : undefined
      });
    } catch (_) {
      return { data: null, status: 0, error: { message: 'Hors-ligne ou serveur injoignable.', status: 0 } };
    }
    if (res.status === 401 && s && s.refresh_token && !opts._retried) {
      if (await refreshSession()) return sbFetch(path, Object.assign({}, opts, { _retried: true }));
      clearSession();
    }
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok) {
      const msg = (json && (json.error_description || json.hint || json.message || json.error)) || ('HTTP ' + res.status);
      return { data: null, status: res.status, error: { message: msg, status: res.status } };
    }
    return { data: json, status: res.status, error: null };
  }
  const authPost = (path, body) => sbFetch(path, { method: 'POST', body });

  /* ---------- Schéma d'entité (source unique : ENTITY_SCHEMA de utils.js) ---------- */
  function fieldsOf(key) {
    const s = (window.ENTITY_SCHEMA || {})[key];
    return s && s.fields ? s.fields : [];
  }
  function coerceField(f, val) {
    if (val === undefined || val === null || val === '') return f.type === 'number' ? null : (f.type === 'bool' ? false : '');
    if (f.type === 'number') { const n = Number(val); return Number.isFinite(n) ? n : null; }
    if (f.type === 'bool') return val === true || val === 'true' || val === 1 || val === '1';
    return String(val);
  }
  function colsFrom(flat, key) {
    const cols = {};
    for (const f of fieldsOf(key)) cols[f.key] = coerceField(f, flat[f.key]);
    return cols;
  }
  /* Ligne serve {id, owner_id, cols jsonb, dates} → ligne plate pour l'UI. */
  function flatRow(r) {
    return Object.assign({}, (r && r.cols) || {}, {
      id: r.id, owner_id: r.owner_id, created_by: r.created_by,
      created_at: r.created_at, updated_at: r.updated_at
    });
  }

  /* ---------- Auth ---------- */
  function friendlySignupError(message) {
    const m = String(message || '');
    if (/TRIPA_NO_INVITATION/i.test(m)) return "Aucune invitation valide pour cette adresse email. Demandez un lien d'invitation.";
    if (/already registered|already exists/i.test(m)) return 'Ce compte existe déjà — connectez-vous.';
    if (/confirm/i.test(m)) return "Une confirmation d'email est requise : validez le lien reçu, ou désactivez « Confirm email » dans Supabase.";
    return m || 'Échec de l\'opération.';
  }

  async function registerUser({ email, password, prenom, nom, telephone, asso_type } = {}) {
    if (!email) return { data: null, error: { message: 'Email requis.' } };
    if (!password || password.length < 6) return { data: null, error: { message: 'Mot de passe : 6 caractères minimum.' } };
    email = String(email).trim().toLowerCase();
    const r = await authPost('/auth/v1/signup', { email, password, data: { prenom: prenom || '', nom: nom || '' } });
    if (r.error) return { data: null, error: { message: friendlySignupError(r.error.message) } };
    const j = r.data || {};
    if (!j.access_token) return { data: null, error: { message: friendlySignupError('confirm') } };
    setSession({ access_token: j.access_token, refresh_token: j.refresh_token,
                 user: { id: j.user.id, email: j.user.email || email } });
    /* Le trigger SQL décide : premier inscrit → super_admin ; sinon claim d'invitation. */
    const p = await sbFetch('/rest/v1/profiles', { method: 'POST', prefer: 'return=representation',
      body: { id: j.user.id, email, prenom: prenom || '', nom: nom || '',
              telephone: telephone || '', asso_type: asso_type || '',
              role: 'admin', status: 'pending', invited: false } });
    if (p.error) { clearSession(); return { data: null, error: { message: friendlySignupError(p.error.message) } }; }
    const prof = Array.isArray(p.data) ? p.data[0] : null;
    rawSet('profile_cache', prof);
    logActivity('create', 'profile', 'Compte créé (' + (prof && prof.role) + ')');
    return { data: { user: j.user, profile: prof }, error: null };
  }

  async function loginUser(email, password) {
    if (!email || !password) return { data: null, error: { message: 'Email et mot de passe requis.' } };
    const r = await authPost('/auth/v1/token?grant_type=password',
      { email: String(email).trim().toLowerCase(), password });
    if (r.error) {
      const em = String((r.error && r.error.message) || '');
      const msg = /email not confirmed|email_not_confirmed/i.test(em)
        ? "Cette adresse email n'a pas été confirmée. Vérifiez votre boîte mail ou contactez l'administrateur."
        : (r.status === 400 ? 'Email ou mot de passe incorrect.' : friendlySignupError(em));
      return { data: null, error: { message: msg, status: r.status } };
    }
    const j = r.data;
    setSession({ access_token: j.access_token, refresh_token: j.refresh_token,
                 user: { id: j.user.id, email: j.user.email } });
    let { data: prof, error } = await fetchCurrentUser();
    /* Profil absent (inscription passée par « Confirmer l'email » ou compte
     * créé depuis le dashboard) : on le crée à la volée. C'est le trigger SQL
     * qui décide du rôle — premier inscrit = super_admin, sinon invitation
     * obligatoire — donc aucune élévation de privilège n'est possible ici. */
    if (!error && !prof) prof = await bootstrapProfile(j.user);
    if (!prof) { clearSession(); return { data: null, error: { message: error ? error.message : "Aucune invitation valide pour cette adresse email. Demandez un lien d'invitation à votre administrateur." } }; }
    return { data: { user: j.user, profile: prof }, error: null };
  }

  /* Insère le profil manquant du compte connecté ; renvoie le profil ou null. */
  async function bootstrapProfile(user) {
    const email = String((user && user.email) || '').trim().toLowerCase();
    const meta = (user && user.user_metadata) || {};
    const p = await sbFetch('/rest/v1/profiles', { method: 'POST', prefer: 'return=representation',
      body: { id: user.id, email, prenom: meta.prenom || meta.first_name || '', nom: meta.nom || meta.last_name || '',
              telephone: '', asso_type: '', role: 'admin', status: 'pending', invited: false } });
    if (p.error) return null;
    const prof = Array.isArray(p.data) ? p.data[0] : null;
    if (prof) rawSet('profile_cache', prof);
    return prof || null;
  }

  async function recoverPassword(email) {
    if (!email) return { data: null, error: { message: 'Email requis.' } };
    const r = await sbFetch('/auth/v1/recover', { method: 'POST',
      body: { email: String(email).trim().toLowerCase(), redirect_to: location.origin + location.pathname.replace(/[^/]*$/, 'index.html') } });
    if (r.error) return { data: null, error: r.error };
    return { data: { message: 'OK' }, error: null };
  }

  async function fetchCurrentUser() {
    const s = getSession();
    if (!s || !s.user) return { data: null, error: { message: 'Non authentifié.' } };
    const r = await sbFetch('/rest/v1/profiles?id=eq.' + s.user.id + '&limit=1&select=*');
    if (r.error) return { data: rawGet('profile_cache', null), error: r.error };
    const prof = (r.data || [])[0] || null;
    if (prof) rawSet('profile_cache', prof);
    return { data: prof, error: null };
  }

  async function logoutUser() {
    try { await sbFetch('/auth/v1/logout', { method: 'POST' }); } catch (_) {}
    clearSession();
    return { data: { message: 'OK' }, error: null };
  }

  async function signOut() { await logoutUser(); location.href = 'index.html'; }

  async function changePassword(cur, nw) {
    const s = getSession();
    if (!s) return { data: null, error: { message: 'Non connecté.' } };
    if (!nw || String(nw).length < 6) return { data: null, error: { message: 'Nouveau mot de passe : 6 caractères minimum.' } };
    const check = await authPost('/auth/v1/token?grant_type=password', { email: s.user.email, password: String(cur || '') });
    if (check.error) return { data: null, error: { message: 'Mot de passe actuel incorrect.' } };
    const r = await sbFetch('/auth/v1/user', { method: 'PUT', body: { password: String(nw) } });
    if (r.error) return r;
    logActivity('update', 'profile', 'Mot de passe modifié');
    return { data: { message: 'OK' }, error: null };
  }

  async function updateOwnProfile(patch) {
    const prof = rawGet('profile_cache', null);
    if (!prof) return { data: null, error: { message: 'Non connecté.' } };
    const body = {};
    for (const k of ['prenom', 'nom', 'telephone', 'asso_type']) if (k in (patch || {})) body[k] = String(patch[k] || '');
    const r = await sbFetch('/rest/v1/profiles?row_id=eq.' + prof.row_id + '&select=*',
      { method: 'PATCH', prefer: 'return=representation', body });
    if (r.error) return r;
    const merged = (r.data || [])[0] || Object.assign({}, prof, body);
    rawSet('profile_cache', merged);
    logActivity('update', 'profile', 'Profil mis à jour');
    return { data: merged, error: null };
  }

  function hasKey() { return !!getSession(); }          /* compat anciens appels */
  function isUnlocked() { return !!getSession(); }      /* compat anciens appels */
  function isSuperAdmin() { const p = rawGet('profile_cache', null); return !!p && p.role === 'super_admin'; }

  /* ---------- Journal d'activité ---------- */
  function logActivity(action, entity, label) {
    if (!getSession()) return;
    sbFetch('/rest/v1/activity', { method: 'POST', prefer: 'return=minimal',
      body: { action, entity, label: String(label || '').slice(0, 200),
              user_email: (getSession().user || {}).email || '' } }).then(() => {});
  }

  /* ---------- Définition d'entité ---------- */
  function getEntityDef(key) {
    const s = (window.ENTITY_SCHEMA || {})[key];
    const columns = fieldsOf(key).map(c => Object.assign({}, c));
    return { key, label: (s && s.label) || key, columns, columnDefs: columns };
  }

  /* ---------- CRUD générique ---------- */
  async function fetchAll(key, opts) {
    opts = opts || {};
    if (!(window.ENTITY_SCHEMA || {})[key]) return { data: [], error: { message: 'Entité inconnue' } };
    const r = await sbFetch('/rest/v1/' + key + '?select=*&order=created_at.desc&limit=5000');
    if (r.error) return { data: null, error: r.error };
    let rows = (r.data || []).map(flatRow);

    const q = String(opts.search || opts.q || '').trim().toLowerCase();
    if (q) rows = rows.filter(row => fieldsOf(key).some(f => String(row[f.key] == null ? '' : row[f.key]).toLowerCase().includes(q)));

    const sortBy = opts.sort || 'created_at';
    const dir = String(opts.dir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      const va = a[sortBy], vb = b[sortBy];
      if (va == null && vb == null) return 0;
      if (va == null) return dir; if (vb == null) return -dir;
      if (typeof va === 'number' || typeof vb === 'number') return (Number(va) - Number(vb)) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });

    const per = Number(opts.limit || opts.per || opts.perPage || 25) || 25;
    const page = Number(opts.page) || 1;
    const paged = rows.slice((page - 1) * per, page * per);
    const result = paged.map(x => Object.assign({}, x));
    result.total = rows.length; result.page = page; result.perPage = per;
    result.totalPages = Math.max(1, Math.ceil(rows.length / per));
    result.columns = fieldsOf(key).map(c => Object.assign({}, c));
    result.columnDefs = result.columns;
    return { data: result, error: null };
  }

  async function fetchById(key, id) {
    const r = await sbFetch('/rest/v1/' + key + '?id=eq.' + encodeURIComponent(id) + '&limit=1&select=*');
    if (r.error) return { data: null, error: r.error };
    const row = (r.data || [])[0];
    return row ? { data: flatRow(row), error: null } : { data: null, error: { message: 'Introuvable' } };
  }

  async function insertRow(key, flat) {
    flat = flat || {};
    if (!(window.ENTITY_SCHEMA || {})[key]) return { data: null, error: { message: 'Entité inconnue' } };
    const r = await sbFetch('/rest/v1/' + key, { method: 'POST', prefer: 'return=representation',
      body: { cols: colsFrom(flat, key) } });
    if (r.error) return { data: null, error: r.error };
    const row = flatRow((r.data || [])[0] || {});
    logActivity('create', key, rowTitleSafe(key, row) || row.id);
    return { data: row, error: null };
  }

  async function updateRow(key, id, patch) {
    patch = patch || {};
    const cur = await fetchById(key, id);
    if (cur.error) return cur;
    const merged = Object.assign({}, cur.data, patch);
    const r = await sbFetch('/rest/v1/' + key + '?id=eq.' + encodeURIComponent(id) + '&select=*',
      { method: 'PATCH', prefer: 'return=representation', body: { cols: colsFrom(merged, key) } });
    if (r.error) return r;
    const row = flatRow((r.data || [])[0] || merged);
    logActivity('update', key, rowTitleSafe(key, row) || id);
    return { data: row, error: null };
  }

  async function deleteRow(key, id) {
    const cur = await fetchById(key, id);
    const r = await sbFetch('/rest/v1/' + key + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
    if (r.error) return r;
    if (!cur.error && cur.data) logActivity('delete', key, rowTitleSafe(key, cur.data) || id);
    return { data: { message: 'OK', id }, error: null };
  }

  function rowTitleSafe(key, row) {
    const tf = ((window.ENTITY_SCHEMA || {})[key] || {}).titleField || [];
    const t = tf.map(k => row[k]).filter(Boolean).join(' ');
    return t || row.titre || row.nom || row.libelle || row.fournisseur || row.periode || '';
  }

  /* ---------- Tableau de bord ---------- */
  async function fetchStats() {
    const tables = {};
    const results = await Promise.all(KEYS_ENTITIES.map(k => fetchAll(k, { limit: 5000 })));
    KEYS_ENTITIES.forEach((k, i) => { tables[k] = (!results[i].error && results[i].data) ? results[i].data : []; });

    const counts = {}; KEYS_ENTITIES.forEach(k => { counts[k] = tables[k].length; });
    const tally = (k, field) => { const m = {}; tables[k].forEach(r => { const v = r[field] || '—'; m[v] = (m[v] || 0) + 1; }); return m; };
    const tallies = { adherents: tally('adherents', 'statut'), cotisations: tally('cotisations', 'statut'),
                      taches: tally('taches', 'statut'), evenements: tally('evenements', 'type') };

    const all = [];
    KEYS_ENTITIES.forEach(k => { for (const r of tables[k]) all.push({ key: k, label: String(rowTitleSafe(k, r) || 'Sans titre'), updated_at: r.updated_at || r.created_at || '' }); });
    all.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    const recent = all.slice(0, 5).map(r => ({ key: r.key, label: r.label }));

    const moisPrefix = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
    let month_encaissees = 0, month_count = 0, total_encaisse = 0;
    for (const c of tables.cotisations) {
      if (String(c.statut || '') !== 'payee') continue;
      const m = Number(c.montant || 0);
      total_encaisse += m;
      if (String(c.date || c.date_paiement || '').startsWith(moisPrefix)) { month_encaissees += m; month_count++; }
    }
    return { data: { counts, tallies, recent, month_encaissees, month_count, total_encaisse }, error: null };
  }

  async function fetchActivity(limit) {
    const n = Number(limit) || 200;
    const r = await sbFetch('/rest/v1/activity?order=created_at.desc&limit=' + n + '&select=*');
    if (r.error) return { data: [], error: r.error };
    return { data: (r.data || []).map(a => ({ id: a.id, action: a.action, entity: a.entity, label: a.label, created_at: a.created_at })), error: null };
  }

  /* ---------- Sauvegarde / restauration ---------- */
  async function fetchBackup() {
    const entities = {};
    const results = await Promise.all(KEYS_ENTITIES.map(k => fetchAll(k, { limit: 5000 })));
    KEYS_ENTITIES.forEach((k, i) => { entities[k] = (!results[i].error && results[i].data) ? results[i].data.map(x => Object.assign({}, x)) : []; });
    const p = rawGet('profile_cache', null);
    if (p) entities.admins = [Object.assign({}, p)];
    return { data: { version: 4, exported_at: nowIso(), entities }, error: null };
  }

  async function restoreBackup(payload) {
    const src = (payload && payload.entities) ? payload.entities : payload;
    if (!src || typeof src !== 'object') return { data: null, error: { message: 'Format invalide.' } };
    const s = getSession();
    if (!s) return { data: null, error: { message: 'Non connecté.' } };
    for (const k of KEYS_ENTITIES) {
      const rows = Array.isArray(src[k]) ? src[k] : [];
      const del = await sbFetch('/rest/v1/' + k + '?id=not.is.null', { method: 'DELETE' });
      if (del.error) return { data: null, error: del.error };
      if (!rows.length) continue;
      const body = rows.map(r => ({ id: r.id || genId(), cols: colsFrom(r, k) }));
      const ins = await sbFetch('/rest/v1/' + k, { method: 'POST', prefer: 'return=minimal', body });
      if (ins.error) return { data: null, error: ins.error };
    }
    logActivity('create', 'system', 'Restauration effectuée');
    return { data: { message: 'OK' }, error: null };
  }

  /* ---------- Invitations & console Super Admin ---------- */
  async function hasSuperAdmin() {
    const r = await sbFetch('/rest/v1/rpc/has_super_admin');
    return !r.error && r.data === true;
  }
  async function fetchInvitation(token) {
    const r = await sbFetch('/rest/v1/invitations?select=token,email,prenom,nom,telephone,asso_type,role&token=eq.' + encodeURIComponent(token) + '&accepted_at=is.null&limit=1');
    if (r.error) return { data: null, error: r.error };
    return { data: (r.data || [])[0] || null, error: null };
  }
  async function createInvitation({ email, prenom, nom, telephone, asso_type, role }) {
    const s = getSession();
    if (!s) return { data: null, error: { message: 'Non connecté.' } };
    const token = genId();
    const r = await sbFetch('/rest/v1/invitations', { method: 'POST', prefer: 'return=representation',
      body: { token, email: String(email || '').trim().toLowerCase(), prenom: prenom || '', nom: nom || '',
              telephone: telephone || '', asso_type: asso_type || '', role: role || 'user', created_by: s.user.id } });
    if (r.error) return { data: null, error: r.error };
    const inv = (r.data || [])[0];
    logActivity('create', 'invitation', 'Invitation ' + (inv && inv.role) + ' : ' + (inv && inv.email));
    return { data: inv, error: null };
  }
  async function listInvitations() {
    const s = getSession();
    if (!s) return { data: [], error: { message: 'Non connecté.' } };
    const q = isSuperAdmin() ? 'select=*' : 'select=*&created_by=eq.' + s.user.id;
    const r = await sbFetch('/rest/v1/invitations?' + q + '&order=created_at.desc&limit=200');
    if (r.error) return { data: [], error: r.error };
    return { data: (r.data || []).filter(x => !x.accepted_at), error: null };
  }
  async function deleteInvitation(token) {
    const r = await sbFetch('/rest/v1/invitations?token=eq.' + encodeURIComponent(token), { method: 'DELETE' });
    return r.error ? r : { data: { message: 'OK' }, error: null };
  }
  async function listAdmins() {
    const r = await sbFetch('/rest/v1/profiles?select=*&role=eq.admin&order=created_at.desc&limit=500');
    if (r.error) return { data: [], error: r.error };
    return { data: r.data || [], error: null };
  }
  async function listUsers() {
    const r = await sbFetch('/rest/v1/profiles?select=*&role=eq.user&order=created_at.desc&limit=1000');
    if (r.error) return { data: [], error: r.error };
    return { data: r.data || [], error: null };
  }
  async function setProfileStatus(rowId, status) {
    const r = await sbFetch('/rest/v1/profiles?row_id=eq.' + encodeURIComponent(rowId) + '&select=*',
      { method: 'PATCH', prefer: 'return=representation', body: { status } });
    if (r.error) return r;
    logActivity('update', 'profile', 'Statut ' + status + ' : ' + ((r.data || [])[0] || {}).email);
    return { data: (r.data || [])[0], error: null };
  }
  function invitationLink(token) {
    return new URL('register.html?invite=' + encodeURIComponent(token), location.href).href;
  }

  /* ---------- Guards de page ---------- */
  async function initAuth() { return !!getSession(); }

  async function requireAuth(statuses, roles) {
    if (!getSession()) {
      const back = encodeURIComponent(location.pathname.split('/').pop() + location.search || 'index.html');
      location.href = 'index.html?next=' + back;
      return null;
    }
    const { data: prof } = await fetchCurrentUser();
    if (!prof) { appCmd('Compte introuvable — reconnectez-vous.', 'err'); await logoutUser(); location.href = 'index.html'; return null; }
    if (statuses && statuses.length && !statuses.includes(prof.status)) {
      const msg = prof.status === 'suspended' ? 'Compte suspendu — contactez le Super Admin.'
                : prof.status === 'revoked'   ? 'Compte révoqué.'
                : 'Compte en attente de validation.';
      appCmd(msg, 'err'); setTimeout(() => signOut(), 1600); return null;
    }
    if (roles && roles.length && !roles.includes(prof.role)) {
      appCmd('Page réservée à un autre rôle.', 'err'); location.href = 'dashboard.html'; return null;
    }
    return prof;
  }

  async function redirectIfAuthed() {
    if (!getSession()) return false;
    const { data: prof } = await fetchCurrentUser();
    if (!prof) return false;
    location.href = prof.role === 'super_admin' ? 'admin-management.html' : 'dashboard.html';
    return true;
  }

  async function protectAll() {
    if (!getSession()) location.href = 'index.html';
  }

  /* ---------- API publique ---------- */
  return {
    SUPABASE_URL, appCmd,
    registerUser, loginUser, recoverPassword, fetchCurrentUser, logoutUser, signOut,
    changePassword, updateOwnProfile,
    hasKey, isUnlocked, isSuperAdmin, getSession,
    initAuth, protectAll, requireAuth, redirectIfAuthed,
    getEntityDef, fetchAll, fetchById, insertRow, updateRow, deleteRow,
    fetchStats, fetchActivity,
    fetchBackup, restoreBackup,
    hasSuperAdmin, fetchInvitation, createInvitation, listInvitations, deleteInvitation,
    invitationLink, listAdmins, listUsers, setProfileStatus,
    KEYS: KEYS_ENTITIES
  };
})();

/* Expose globalement : API.xxx ET alias courts pour les modules historiques. */
if (typeof window !== 'undefined') {
  window.API = API;
  Object.assign(window, {
    appCmd: API.appCmd,
    fetchAll: API.fetchAll, insertRow: API.insertRow, updateRow: API.updateRow, deleteRow: API.deleteRow,
    fetchById: API.fetchById, getEntityDef: API.getEntityDef,
    fetchStats: API.fetchStats, fetchActivity: API.fetchActivity,
    fetchBackup: API.fetchBackup, restoreBackup: API.restoreBackup,
    changePassword: API.changePassword, updateOwnProfile: API.updateOwnProfile,
    loginUser: API.loginUser, registerUser: API.registerUser, recoverPassword: API.recoverPassword,
    fetchCurrentUser: API.fetchCurrentUser, logoutUser: API.logoutUser, signOut: API.signOut,
    hasSuperAdmin: API.hasSuperAdmin, fetchInvitation: API.fetchInvitation,
    createInvitation: API.createInvitation, listInvitations: API.listInvitations,
    deleteInvitation: API.deleteInvitation, invitationLink: API.invitationLink,
    listAdmins: API.listAdmins, listUsers: API.listUsers, setProfileStatus: API.setProfileStatus,
    isSuperAdmin: API.isSuperAdmin,
    initAuth: API.initAuth, protectAll: API.protectAll,
    requireAuth: API.requireAuth, redirectIfAuthed: API.redirectIfAuthed,
    getSessionProfile: () => API.getSession() ? (JSON.parse(localStorage.getItem('tripa_profile_cache') || 'null')) : null,
    setSessionToken: () => {},
    saveSessionProfile: (p) => localStorage.setItem('tripa_profile_cache', JSON.stringify(p))
  });
}
