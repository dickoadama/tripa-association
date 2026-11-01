/* ==========================================
   TRIPA — Client API (api.js)
   Remplace Supabase : dialogue avec le backend
   Express + SQLite (dossier server/).
   Surface d'API identique à l'ancienne :
   fetchAll / insertRow / updateRow / deleteRow /
   requireAuth / requireSuperAdmin / session profil.
   ========================================== */

// Adresse du serveur TRIPA :
// - page servie en http(s) (local ou en ligne) → API sur le même serveur ('/api')
// - page ouverte en file:// → serveur local par défaut sur le port 3000
// Surcharger avec window.TRIPA_API_BASE pour pointer une autre machine.
const API_BASE = window.TRIPA_API_BASE ||
  (location.protocol.startsWith('http') ? '/api' : 'http://localhost:3000/api');

// Le Super Admin unique de TRIPA — modifiez cette adresse si besoin
const SUPER_ADMIN_EMAIL = 'superadmin@tripa.com';

function isSuperAdminEmail(email) {
  return email && String(email).toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

// ==========================================
// Token de session (localStorage via utils.js)
// ==========================================

function getSessionToken() { return loadFromLocal('token'); }
function setSessionToken(token) { saveToLocal('token', token); }
function clearSessionToken() { removeFromLocal('token'); }

// ==========================================
// Requête HTTP générique — renvoie { data, error }
// ==========================================

async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', body = null, params = null } = options;

  let url = API_BASE + endpoint;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    }
    const qsStr = qs.toString();
    if (qsStr) url += '?' + qsStr;
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = getSessionToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: { message: (json.error && json.error.message) || `Erreur ${res.status}`, status: res.status } };
    }
    return { data: json.data !== undefined ? json.data : null, error: null };
  } catch (e) {
    return { data: null, error: { message: 'Serveur TRIPA injoignable. Lancez « node server/server.js » (voir console).' } };
  }
}

// ==========================================
// CRUD générique (même signature qu'avant)
// ==========================================

async function fetchAll(table, options = {}) {
  const params = {};
  if (options.filter) Object.assign(params, options.filter);
  if (options.order) {
    params.order = options.order.column;
    params.dir = options.order.ascending ? 'asc' : 'desc';
  }
  if (options.limit) params.limit = options.limit;
  const { data, error } = await apiRequest(`/${table}`, { params });
  return { data, error };
}

async function fetchById(table, id) {
  const { data, error } = await apiRequest(`/${table}`, { params: { id_match: id } });
  if (error) return { data: null, error };
  const row = (data || []).find(r => r.id === id) || null;
  return { data: row, error: row ? null : { message: 'Introuvable' } };
}

async function insertRow(table, row) {
  return apiRequest(`/${table}`, { method: 'POST', body: row });
}

async function updateRow(table, id, updates) {
  return apiRequest(`/${table}/${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
}

async function deleteRow(table, id) {
  return apiRequest(`/${table}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ==========================================
// Authentification
// ==========================================

async function registerUser(payload) {
  return apiRequest('/auth/register', { method: 'POST', body: payload });
}

async function loginUser(email, password) {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password } });
}

async function logoutUser() {
  await apiRequest('/auth/logout', { method: 'POST' });
  clearSessionToken();
  clearSessionProfile();
}

async function fetchCurrentUser() {
  return apiRequest('/auth/me');
}

async function changePassword(currentPassword, newPassword) {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword }
  });
}

// Compat : signOut() redirige comme avant
async function signOut() {
  await logoutUser();
  window.location.href = 'index.html';
}

// ==========================================
// Gestion des comptes (Super Admin)
// ==========================================

async function getAllAdmins() {
  const { data, error } = await apiRequest('/admin/users');
  return { data: data || [], error };
}

async function createAdminAccount(payload) {
  return apiRequest('/admin/users', { method: 'POST', body: payload });
}

async function updateAdminAccount(id, updates) {
  return apiRequest(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
}

async function deleteAdminAccount(id) {
  return apiRequest(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ==========================================
// Profils / session applicative
// ==========================================

function saveSessionProfile(profile) { saveToLocal('session_profile', profile); }
function getSessionProfile() { return loadFromLocal('session_profile'); }
function clearSessionProfile() { removeFromLocal('session_profile'); }

/**
 * Vérifie la session auprès du serveur.
 * Redirige vers index.html si absent / invalide / statut non autorisé.
 */
async function requireAuth(allowedStatuses = ['active']) {
  if (!getSessionToken()) {
    clearSessionProfile();
    window.location.href = 'index.html';
    return null;
  }

  const { data: profile, error } = await fetchCurrentUser();
  if (error || !profile) {
    clearSessionToken();
    clearSessionProfile();
    window.location.href = 'index.html';
    return null;
  }

  if (!allowedStatuses.includes(profile.status)) {
    clearSessionToken();
    clearSessionProfile();
    window.location.href = 'index.html';
    return null;
  }

  saveSessionProfile(profile);
  return profile;
}

async function requireSuperAdmin() {
  const profile = await requireAuth(['active', 'pending', 'suspended']);
  if (!profile) return null;
  if (profile.role !== 'super_admin') {
    window.location.href = 'dashboard.html';
    return null;
  }
  return profile;
}

// ==========================================
// Garde de session (fusion depuis session-guard.js)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  const profile = await requireAuth(['active']);
  if (!profile) return;

  // Le Super Admin accède au dashboard classique en lecture :
  // on affiche le lien vers sa console dédiée dans la sidebar
  if (profile.role === 'super_admin') {
    const nav = document.querySelector('.sidebar__nav');
    if (nav && !document.getElementById('super-admin-link')) {
      const link = document.createElement('a');
      link.id = 'super-admin-link';
      link.href = 'admin-management.html';
      link.className = 'sidebar__link';
      link.innerHTML = '<i data-lucide="shield-check"></i><span>Console Super Admin</span>';
      nav.insertBefore(link, nav.firstChild.nextSibling);
      if (window.lucide) lucide.createIcons();
    }
  }

  // Personnaliser l'en-tête utilisateur si présent
  const userName = document.querySelector('.sidebar__user .user-info span:first-child');
  if (userName && profile.first_name) {
    userName.textContent = `${profile.first_name} ${profile.last_name || ''}`.trim();
  }
});
