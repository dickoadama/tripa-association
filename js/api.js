'use strict';
/* TRIPA — Couche de données 100 % locale (localStorage, zéro backend).
 *
 * Signatures asynchrones identiques à la version serveur v3 pour que les
 * modules existants (entity.js, settings.js, profile.js, activity.js, auth.js,
 * dashboard inline, utils.js) fonctionnent sans modification.
 *
 * Formes de stockage localStorage :
 *   tripa_data_<entité>   JSON  [ { id, <champ>: <valeur>, ...,
 *                                    created_at, updated_at }, ... ]
 *   tripa_activity        JSON  [ { id, action, entity, label, created_at }, ... ]
 *   tripa_profile         JSON  { id, prenom, nom, email, telephone,
 *                                 asso_type, role, status, created_at }
 *   tripa_key             JSON  « hash-sha256-hex » du code d'accès local
 *   tripa_unlocked        '1'   présent = session déverrouillée
 */
const API = (() => {

  const ENTITIES = {
    adherents:      { label: 'Adhérents',      cols: [{key:'nom',label:'Nom',type:'text'},{key:'prenoms',label:'Prénoms',type:'text'},{key:'date_naissance',label:'Date de naissance',type:'date'},{key:'lieu_naissance',label:'Lieu de naissance',type:'text'},{key:'nationalite',label:'Nationalité',type:'text'},{key:'adresse',label:'Adresse',type:'text'},{key:'telephone',label:'Téléphone',type:'text'},{key:'email',label:'Email',type:'text'},{key:'profession',label:'Profession',type:'text'},{key:'groupe_sanguin',label:'Groupe sanguin',type:'text'},{key:'allergies',label:'Allergies',type:'text'},{key:'contact_urgence',label:"Contact d'urgence",type:'text'},{key:'telephone_urgence',label:"Téléphone d'urgence",type:'text'},{key:'date_adhesion',label:"Date d'adhésion",type:'date'},{key:'statut',label:'Statut',type:'text'}] },
    cotisations:    { label: 'Cotisations',    cols: [{key:'date',label:'Date',type:'date'},{key:'montant',label:'Montant',type:'num'},{key:'mode',label:'Mode de paiement',type:'text'},{key:'periode',label:'Période',type:'text'},{key:'recu',label:'N° Reçu',type:'text'},{key:'statut',label:'Statut',type:'text'},{key:'adherent',label:'Adhérent',type:'text'},{key:'notes',label:'Notes',type:'text'}] },
    evenements:     { label: 'Événements',     cols: [{key:'titre',label:'Titre',type:'text'},{key:'date_debut',label:'Début',type:'date'},{key:'date_fin',label:'Fin',type:'date'},{key:'lieu',label:'Lieu',type:'text'},{key:'type',label:'Type',type:'text'},{key:'participants',label:'Participants',type:'num'},{key:'budget',label:'Budget',type:'num'},{key:'description',label:'Description',type:'text'}] },
    activites:      { label: 'Activités',      cols: [{key:'date',label:'Date',type:'date'},{key:'titre',label:'Titre',type:'text'},{key:'type',label:'Type',type:'text'},{key:'duree',label:'Durée',type:'text'},{key:'animateur',label:'Animateur',type:'text'},{key:'participants',label:'Participants',type:'num'},{key:'notes',label:'Notes',type:'text'}] },
    communications: { label: 'Communications', cols: [{key:'date',label:'Date',type:'date'},{key:'canal',label:'Canal',type:'text'},{key:'destinataire',label:'Destinataire',type:'text'},{key:'objet',label:'Objet',type:'text'},{key:'contenu',label:'Contenu',type:'text'},{key:'statut',label:'Statut',type:'text'}] },
    achats:         { label: 'Achats',         cols: [{key:'date',label:'Date',type:'date'},{key:'article',label:'Article',type:'text'},{key:'fournisseur',label:'Fournisseur',type:'text'},{key:'quantite',label:'Quantité',type:'num'},{key:'montant',label:'Montant',type:'num'},{key:'statut',label:'Statut',type:'text'},{key:'notes',label:'Notes',type:'text'}] },
    documents:      { label: 'Documents',      cols: [{key:'titre',label:'Titre',type:'text'},{key:'type',label:'Type',type:'text'},{key:'date',label:'Date',type:'date'},{key:'auteur',label:'Auteur',type:'text'},{key:'version',label:'Version',type:'text'},{key:'mots_cles',label:'Mots-clés',type:'text'}] },
    taches:         { label: 'Tâches',         cols: [{key:'titre',label:'Titre',type:'text'},{key:'description',label:'Description',type:'text'},{key:'echeance',label:'Échéance',type:'date'},{key:'priorite',label:'Priorité',type:'text'},{key:'assigne',label:'Assignée à',type:'text'},{key:'statut',label:'Statut',type:'text'}] }
  };
  const KEYS = Object.keys(ENTITIES);
  const PFX = 'tripa_';

  /* ---------- localStorage ---------- */
  function rawGet(k, def) {
    try { const s = localStorage.getItem(PFX + k); return s === null ? def : JSON.parse(s); }
    catch (_) { return def; }
  }
  function rawSet(k, v) {
    try { localStorage.setItem(PFX + k, JSON.stringify(v)); return true; }
    catch (_) { appCmd('Stockage local saturé.', 'err'); return false; }
  }
  function rawDel(k) { try { localStorage.removeItem(PFX + k); } catch (_) {} }

  const rowsFor = (t) => { const a = rawGet('data_' + t, []); return Array.isArray(a) ? a : []; };
  const saveRows = (t, rows) => rawSet('data_' + t, rows);

  const genId = () => (self.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : ('id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  const nowIso = () => new Date().toISOString();

  function coerce(col, val) {
    if (val === undefined || val === null || val === '') return col.type === 'num' ? null : '';
    if (col.type === 'bool') return (val === true || val === 1 || val === '1' || val === 'true' || val === 'oui') ? 1 : 0;
    if (col.type === 'num') { const n = Number(val); return Number.isFinite(n) ? n : null; }
    return String(val);
  }

  /* Normalise une ligne brute (plate OU avec cols/dates imbriqués) vers la
   * forme plate { id, ...champs, ...dates } utilisée partout dans l'UI. */
  function normalizeRow(def, raw) {
    const out = { id: raw.id || genId() };
    const src = (raw.cols && typeof raw.cols === 'object') ? raw.cols : raw;
    for (const c of def.cols) out[c.key] = coerce(c, src[c.key]);
    const dt = (raw.dates && typeof raw.dates === 'object') ? raw.dates : raw;
    out.created_at = dt.created_at || nowIso();
    out.updated_at = dt.updated_at || out.created_at;
    return out;
  }

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

  /* ---------- SHA-256 hex (avec fallback FNV non crypto) ---------- */
  async function sha256Hex(str) {
    if (self.crypto && crypto.subtle && crypto.subtle.digest) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (_) {}
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'fnv-' + h.toString(16) + '-' + str.length;
  }

  /* ---------- Journal d'activité ---------- */
  function logActivity(action, entity, label) {
    const arr = rawGet('activity', []);
    arr.unshift({ id: genId(), action, entity, label: String(label || '').slice(0, 200), created_at: nowIso() });
    if (arr.length > 500) arr.length = 500;
    rawSet('activity', arr);
  }

  /* ---------- Profil / Auth ---------- */
  function defaultProfile() {
    return {
      id: genId(), prenom: '', nom: '', email: '', telephone: '',
      asso_type: '', role: 'admin', status: 'active', created_at: nowIso()
    };
  }

  async function registerUser({ password } = {}) {
    if (!password || String(password).length < 4)
      return { data: null, error: { message: "Le code d'accès doit contenir au moins 4 caractères." } };
    if (rawGet('key', null))
      return { data: null, error: { message: "Un code d'accès existe déjà. Réinitialisation : localStorage.removeItem('tripa_key')." } };
    rawSet('key', await sha256Hex(password));
    const prof = rawGet('profile', null) || defaultProfile();
    rawSet('profile', prof);
    rawSet('unlocked', '1');
    logActivity('create', 'profile', 'Compte local initialisé');
    return { data: { token: 'local', user: prof, profile: prof }, error: null };
  }

  async function loginUser(_email, password) {
    const hash = rawGet('key', null);
    if (!hash) return { data: null, error: { message: "Aucun compte. Définissez d'abord un code d'accès." } };
    if (!password) return { data: null, error: { message: 'Code requis.' } };
    const candidate = await sha256Hex(password);
    if (candidate !== hash) return { data: null, error: { message: "Code d'accès incorrect." } };
    rawSet('unlocked', '1');
    let prof = rawGet('profile', null);
    if (!prof) { prof = defaultProfile(); rawSet('profile', prof); }
    return { data: { token: 'local', user: prof, profile: prof }, error: null };
  }

  async function fetchCurrentUser() {
    if (!rawGet('unlocked', null)) return { data: null, error: { message: 'Non authentifié' } };
    let p = rawGet('profile', null);
    if (!p) { p = defaultProfile(); rawSet('profile', p); }
    return { data: p, error: null };
  }

  async function logoutUser() { rawDel('unlocked'); return { data: { message: 'OK' }, error: null }; }

  async function signOut() {
    rawDel('unlocked');
    location.href = 'index.html';
  }

  async function changePassword(cur, nw) {
    const hash = rawGet('key', null);
    if (!hash) return { data: null, error: { message: 'Aucun compte.' } };
    if (await sha256Hex(String(cur || '')) !== hash)
      return { data: null, error: { message: 'Code actuel incorrect.' } };
    if (!nw || String(nw).length < 4)
      return { data: null, error: { message: 'Nouveau code trop court (min. 4).' } };
    rawSet('key', await sha256Hex(nw));
    logActivity('update', 'profile', 'Code modifié');
    return { data: { message: 'OK' }, error: null };
  }

  async function updateOwnProfile(patch) {
    const p = rawGet('profile', null) || defaultProfile();
    const merged = Object.assign({}, p, patch || {});
    rawSet('profile', merged);
    logActivity('update', 'profile', 'Profil mis à jour');
    return { data: merged, error: null };
  }

  function hasKey() { return !!rawGet('key', null); }
  function isUnlocked() { return !!rawGet('unlocked', null); }

  /* ---------- Définition d'entité ---------- */
  function getEntityDef(key) {
    const def = ENTITIES[key];
    if (!def) return { key, label: key, columns: [], columnDefs: [] };
    const columns = def.cols.map(c => Object.assign({}, c));
    return { key, label: def.label, columns, columnDefs: columns };
  }

  /* ---------- CRUD générique (data = tableau plat) ---------- */
  async function fetchAll(key, opts) {
    opts = opts || {};
    if (!ENTITIES[key]) return { data: [], error: { message: 'Entité inconnue' } };
    const def = ENTITIES[key];
    let rows = rowsFor(key);

    const q = String(opts.search || opts.q || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter(r => def.cols.some(c => String(r[c.key] == null ? '' : r[c.key]).toLowerCase().includes(q)));
    }

    const sortBy = opts.sort || 'updated_at';
    const dirRaw = String(opts.dir || opts.order || 'desc').toLowerCase();
    const dir = dirRaw === 'asc' ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      const va = a[sortBy], vb = b[sortBy];
      if (sortBy === 'created_at' || sortBy === 'updated_at' || sortBy.endsWith('date') || sortBy.startsWith('date_'))
        return String(va || '').localeCompare(String(vb || '')) * dir;
      return String(va == null ? '' : va).localeCompare(String(vb == null ? '' : vb)) * dir;
    });

    const per = Number(opts.limit || opts.per || opts.perPage || 25) || 25;
    const page = Number(opts.page) || 1;
    const paged = rows.slice((page - 1) * per, page * per);

    // Expose aussi total/colonnes sur l'objet retourné pour les usages avancés
    // sans casser les consommateurs qui traitent `data` comme un tableau.
    const result = paged.map(r => Object.assign({}, r));
    result.total = rows.length; result.page = page; result.perPage = per;
    result.totalPages = Math.max(1, Math.ceil(rows.length / per));
    result.columns = def.cols.map(c => Object.assign({}, c));
    result.columnDefs = result.columns;
    return { data: result, error: null };
  }

  async function fetchById(key, id) {
    if (!ENTITIES[key]) return { data: null, error: { message: 'Entité inconnue' } };
    const r = rowsFor(key).find(x => x.id === id);
    return r ? { data: Object.assign({}, r), error: null } : { data: null, error: { message: 'Introuvable' } };
  }

  async function insertRow(key, cols) {
    cols = cols || {};
    if (!ENTITIES[key]) return { data: null, error: { message: 'Entité inconnue' } };
    const def = ENTITIES[key];
    const row = { id: cols.id || genId() };
    for (const col of def.cols) row[col.key] = coerce(col, cols[col.key]);
    row.created_at = cols.created_at || nowIso();
    row.updated_at = cols.updated_at || row.created_at;
    const rows = rowsFor(key); rows.push(row); saveRows(key, rows);
    const first = def.cols[0];
    logActivity('create', key, (first ? row[first.key] : row.id) || row.id);
    return { data: Object.assign({}, row), error: null };
  }

  async function updateRow(key, id, patch) {
    patch = patch || {};
    if (!ENTITIES[key]) return { data: null, error: { message: 'Entité inconnue' } };
    const def = ENTITIES[key];
    const rows = rowsFor(key);
    const i = rows.findIndex(r => r.id === id);
    if (i < 0) return { data: null, error: { message: 'Introuvable' } };
    for (const col of def.cols) if (col.key in patch) rows[i][col.key] = coerce(col, patch[col.key]);
    rows[i].updated_at = nowIso();
    saveRows(key, rows);
    const first = def.cols[0];
    logActivity('update', key, (first ? rows[i][first.key] : id) || id);
    return { data: Object.assign({}, rows[i]), error: null };
  }

  async function deleteRow(key, id) {
    if (!ENTITIES[key]) return { data: null, error: { message: 'Entité inconnue' } };
    const def = ENTITIES[key];
    const rows = rowsFor(key);
    const row = rows.find(r => r.id === id);
    saveRows(key, rows.filter(r => r.id !== id));
    if (row) {
      const first = def.cols[0];
      logActivity('delete', key, (first ? row[first.key] : id) || id);
    }
    return { data: { message: 'OK', id }, error: null };
  }

  /* ---------- Dashboard stats ---------- */
  async function fetchStats() {
    const counts = {};
    for (const k of KEYS) counts[k] = rowsFor(k).length;

    const all = [];
    for (const k of KEYS) {
      const def = ENTITIES[k]; const first = def.cols[0];
      for (const r of rowsFor(k)) {
        all.push({
          key: k,
          label: String((first ? r[first.key] : '') || 'Sans titre'),
          updated_at: r.updated_at || r.created_at || ''
        });
      }
    }
    all.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    const recent = all.slice(0, 5).map(r => ({ key: r.key, label: r.label }));

    const now = new Date();
    const moisPrefix = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const cotis = rowsFor('cotisations');
    let month_encaissees = 0, month_count = 0, total_encaisse = 0;
    for (const c of cotis) {
      const m = Number(c.montant || 0);
      const st = String(c.statut || '').toLowerCase();
      if (st === 'annulée' || st === 'annulee') continue;
      total_encaisse += m;
      if (String(c.date || '').startsWith(moisPrefix)) { month_encaissees += m; month_count++; }
    }

    return {
      data: { counts, recent, month_encaissees, month_count, total_encaisse },
      error: null
    };
  }

  async function fetchActivity(limit) {
    const arr = rawGet('activity', []);
    const n = Number(limit) || 200;
    return { data: arr.slice(0, n).map(a => Object.assign({}, a)), error: null };
  }

  /* ---------- Sauvegarde / restauration ---------- */
  async function fetchBackup() {
    const entities = {};
    for (const k of KEYS) entities[k] = rowsFor(k).map(r => Object.assign({}, r));
    const p = rawGet('profile', null);
    if (p) entities.admins = [Object.assign({}, p)];
    return { data: { version: 3, exported_at: nowIso(), entities }, error: null };
  }

  async function restoreBackup(payload) {
    const src = (payload && payload.entities) ? payload.entities : payload;
    if (!src || typeof src !== 'object') return { data: null, error: { message: 'Format invalide.' } };
    for (const k of Object.keys(src)) {
      const rows = src[k];
      if (!Array.isArray(rows)) continue;
      if (k === 'admins') {
        const a = rows[0]; if (!a) continue;
        const prof = normalizeRow({ cols: [
          { key: 'prenom', type: 'text' }, { key: 'nom', type: 'text' }, { key: 'email', type: 'text' },
          { key: 'telephone', type: 'text' }, { key: 'asso_type', type: 'text' },
          { key: 'role', type: 'text' }, { key: 'status', type: 'text' }
        ] }, a);
        prof.id = a.id || genId();
        prof.created_at = (a.dates && a.dates.created_at) || a.created_at || nowIso();
        rawSet('profile', prof);
        continue;
      }
      if (!ENTITIES[k]) continue;
      const def = ENTITIES[k];
      saveRows(k, rows.map(r => normalizeRow(def, r)));
    }
    logActivity('create', 'system', 'Restauration effectuée');
    return { data: { message: 'OK' }, error: null };
  }

  /* ---------- Guards de page ---------- */
  async function initAuth() { return true; }

  async function requireAuth() {
    if (rawGet('unlocked', null)) return rawGet('profile', null) || defaultProfile();
    const back = encodeURIComponent(location.pathname.split('/').pop() || 'index.html');
    location.href = 'index.html?next=' + back;
    return null;
  }

  async function redirectIfAuthed() {
    if (rawGet('unlocked', null)) { location.href = 'dashboard.html'; return true; }
    return false;
  }

  async function protectAll() {
    if (rawGet('unlocked', null)) return;
    location.href = 'index.html';
  }

  /* ---------- API publique ---------- */
  return {
    appCmd,
    registerUser, loginUser, fetchCurrentUser, logoutUser, signOut,
    changePassword, updateOwnProfile,
    hasKey, isUnlocked,
    initAuth, protectAll, requireAuth, redirectIfAuthed,
    getEntityDef, fetchAll, fetchById, insertRow, updateRow, deleteRow,
    fetchStats, fetchActivity,
    fetchBackup, restoreBackup
  };
})();

/* Expose globalement : API.xxx ET alias courts pour les modules historiques.
 * Les alias courts (fetchAll, insertRow, etc.) sont ce que utilisent entity.js,
 * settings.js, profile.js, activity.js, utils.js et dashboard.html inline. */
if (typeof window !== 'undefined') {
  window.API = API;
  Object.assign(window, {
    appCmd: API.appCmd,
    fetchAll: API.fetchAll, insertRow: API.insertRow, updateRow: API.updateRow, deleteRow: API.deleteRow,
    fetchById: API.fetchById, getEntityDef: API.getEntityDef,
    fetchStats: API.fetchStats, fetchActivity: API.fetchActivity,
    fetchBackup: API.fetchBackup, restoreBackup: API.restoreBackup,
    changePassword: API.changePassword, updateOwnProfile: API.updateOwnProfile,
    loginUser: API.loginUser, registerUser: API.registerUser,
    fetchCurrentUser: API.fetchCurrentUser, logoutUser: API.logoutUser, signOut: API.signOut,
    initAuth: API.initAuth, protectAll: API.protectAll,
    requireAuth: API.requireAuth, redirectIfAuthed: API.redirectIfAuthed,
    getSessionProfile: () => (window.API && API.isUnlocked && API.isUnlocked()) ? JSON.parse(localStorage.getItem('tripa_profile') || 'null') : null,
    setSessionToken: () => {}, saveSessionProfile: (p) => localStorage.setItem('tripa_profile', JSON.stringify(p))
  });
}
