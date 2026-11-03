/* TRIPA — Client de l'API (fetch vers le backend Express).
 * Mêmes signatures que la version statique : les modules ne changent pas.
 * La session vit dans un cookie httpOnly posé par le serveur : le front ne
 * manipule AUCUN jeton ni mot de passe. */

function lsGet(k){ try{ return JSON.parse(localStorage.getItem('tripa_'+k)); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem('tripa_'+k, JSON.stringify(v)); }catch(e){} }
function lsDel(k){ try{ localStorage.removeItem('tripa_'+k); }catch(e){} }

function saveSessionProfile(p){ lsSet('session_profile', p); }
function getSessionProfile(){ return lsGet('session_profile'); }
function clearSessionProfile(){ lsDel('session_profile'); }
// Marqueurs conservés pour compatibilité (la vraie session = cookie serveur).
function setSessionToken(t){ if(t) lsSet('logged', 1); }
function getSessionToken(){ return lsGet('logged'); }
function clearSessionToken(){ lsDel('logged'); }

function isSuperAdminEmail(e){ return e && String(e).toLowerCase()==='superadmin@tripa.com'; }

async function req(method, path, body){
  try {
    const res = await fetch('/api' + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    });
    let json;
    try { json = await res.json(); } catch (e) { json = null; }
    if (json && json.error) return { data: json.data ?? null, error: json.error };
    if (!res.ok) return { data: null, error: { message: 'Erreur ' + res.status, status: res.status } };
    return { data: json ? json.data : null, error: null };
  } catch (e) {
    return { data: null, error: { message: 'Serveur injoignable (hors-ligne ?).', status: 0 } };
  }
}

/* ---------- Entités (CRUD + tri/recherche/pagination) ---------- */
async function fetchAll(table, options = {}) {
  const p = new URLSearchParams();
  if (options.search) p.set('search', options.search);
  if (options.order && options.order.column) { p.set('sort', options.order.column); p.set('dir', options.order.ascending ? 'asc' : 'desc'); }
  if (options.sort) { p.set('sort', options.sort); p.set('dir', options.dir || 'asc'); }
  if (options.filter) { const k = Object.keys(options.filter)[0]; if (k) { p.set('col', k); p.set('val', options.filter[k]); } }
  if (options.limit) p.set('limit', options.limit);
  if (options.page) p.set('page', options.page);
  const qs = p.toString();
  return req('GET', '/' + table + (qs ? '?' + qs : ''));
}
async function fetchById(table, id){ return req('GET', '/' + table + '/' + id); }
async function insertRow(table, row){ return req('POST', '/' + table, row || {}); }
async function updateRow(table, id, updates){ return req('PUT', '/' + table + '/' + id, updates || {}); }
async function deleteRow(table, id){ return req('DELETE', '/' + table + '/' + id); }

/* ---------- Authentification ---------- */
async function registerUser(payload){ return req('POST', '/auth/register', payload || {}); }
async function loginUser(email, password, remember){
  const r = await req('POST', '/auth/login', { email, password, remember: !!remember });
  if (r.data && r.data.profile) {
    const st = r.data.profile.status, role = r.data.profile.role;
    r.data.token = (st === 'active' || role === 'super_admin') ? 'session' : null;
  }
  return r;
}
async function fetchCurrentUser(){ return req('GET', '/auth/me'); }
async function logoutUser(){ return req('POST', '/auth/logout'); }
async function changePassword(currentPassword, newPassword){ return req('POST', '/auth/password', { currentPassword, newPassword }); }
async function updateOwnProfile(updates){ return req('PUT', '/auth/profile', updates || {}); }
async function signOut(){ await logoutUser(); clearSessionToken(); clearSessionProfile(); window.location.href = 'index.html'; }

/* ---------- Comptes admin (Super Admin) ---------- */
async function getAllAdmins(){ return req('GET', '/admins'); }
async function createAdminAccount(payload){ return req('POST', '/admins', payload || {}); }
async function updateAdminAccount(id, updates){ return req('PATCH', '/admins/' + id, updates || {}); }
async function deleteAdminAccount(id){ return req('DELETE', '/admins/' + id); }

/* ---------- Sauvegarde / restauration ---------- */
async function fetchBackup(){ return req('GET', '/backup/all'); }
async function restoreBackup(entities){ return req('POST', '/backup/restore', { entities }); }

/* ---------- Statistiques agrégées ---------- */
async function fetchStats(){ return req('GET', '/stats'); }

/* ---------- Journal d'activité ---------- */
async function fetchActivity(limit = 100){ return req('GET', '/activity?limit=' + encodeURIComponent(limit)); }

/* ---------- Gardes de session (côté client, le vrai contrôle est serveur) ---------- */
async function requireAuth(allowed = ['active']) {
  const { data: profile, error } = await fetchCurrentUser();
  if (error || !profile) { clearSessionToken(); clearSessionProfile(); window.location.href = 'index.html'; return null; }
  if (!allowed.includes(profile.status)) { clearSessionToken(); clearSessionProfile(); window.location.href = 'index.html'; return null; }
  saveSessionProfile(profile); return profile;
}
async function requireSuperAdmin() {
  const p = await requireAuth(['active', 'pending', 'suspended']); if (!p) return null;
  if (p.role !== 'super_admin') { window.location.href = 'dashboard.html'; return null; } return p;
}
