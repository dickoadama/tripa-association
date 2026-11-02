/* TRIPA — Authentification & autorisation côté serveur. */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get } = require('./db');

const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE = 'tripa_token';
const MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 jours

function uuid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = crypto.randomBytes(1)[0] % 16, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
    });
}
function hash(pw) { return bcrypt.hashSync(String(pw), 10); }
function verify(pw, hashStr) { try { return bcrypt.compareSync(String(pw), hashStr); } catch (e) { return false; } }

function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: MAX_AGE });
}
function clearAuthCookie(res) { res.clearCookie(COOKIE); }

function signToken(user) { return jwt.sign({ uid: user.id }, SECRET, { expiresIn: '7d' }); }

function publicProfile(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, nom: u.nom, prenom: u.prenom, telephone: u.telephone,
    asso_type: u.asso_type, role: u.role, status: u.status, created_at: u.created_at };
}

// Middleware : lit le cookie, vérifie le jeton, charge l'utilisateur (statut actif seulement).
async function requireUser(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: { message: 'Session invalide.', status: 401 } });
  let payload;
  try { payload = jwt.verify(token, SECRET); }
  catch (e) { clearAuthCookie(res); return res.status(401).json({ error: { message: 'Session expirée.', status: 401 } }); }
  const u = await get('SELECT * FROM users WHERE id = ?', [payload.uid]);
  if (!u) return res.status(401).json({ error: { message: 'Compte introuvable.', status: 401 } });
  if (u.role !== 'super_admin' && u.status !== 'active')
    return res.status(403).json({ error: { message: 'Compte non actif.', status: 403 } });
  req.user = u; next();
}

function requireSuper(req, res, next) {
  if (!req.user || req.user.role !== 'super_admin')
    return res.status(403).json({ error: { message: 'Accès réservé au Super Admin.', status: 403 } });
  next();
}

module.exports = { uuid, hash, verify, signToken, setAuthCookie, clearAuthCookie,
  publicProfile, requireUser, requireSuper, COOKIE, SECRET };
