/* TRIPA — Serveur Express : sert le frontend (build minifié si présent) + l'API REST.
 * La logique métier, l'accès à la base et les secrets restent CÔTÉ SERVEUR. */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');

const { init, all, get, run, toSqlArg, fromRow, ENTITIES, ENTITY_KEYS } = require('./db');
const A = require('./auth');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

/* ---------- Fichiers statiques : dist/ (minifié) sinon public/ (dev) ---------- */
const dist = path.join(__dirname, '..', 'dist');
const pub = path.join(__dirname, '..', 'public');
const webRoot = fs.existsSync(path.join(dist, 'index.html')) ? dist : pub;
app.use(express.static(webRoot, { extensions: ['html'] }));
app.get('/', (_req, res) => res.sendFile(path.join(webRoot, 'index.html')));

/* ---------- Helpers ---------- */
const nowIso = () => new Date().toISOString();
const isAdmin = (u) => u && u.role === 'admin';

function bad(res, code, message) { return res.status(code).json({ error: { message, status: code } }); }

/* ---------- Authentification ---------- */
app.post('/api/auth/register', async (req, res) => {
  const { email, password, nom, prenom, telephone, asso_type } = req.body || {};
  if (!email || !password) return bad(res, 400, 'Email et mot de passe requis.');
  if (String(password).length < 6) return bad(res, 400, 'Mot de passe trop court (6 caractères min).');
  const mail = String(email).toLowerCase();
  if (mail === (process.env.SUPER_ADMIN_EMAIL || 'superadmin@tripa.com').toLowerCase()) return bad(res, 403, 'Adresse réservée.');
  if (await get('SELECT id FROM users WHERE email = ?', [mail])) return bad(res, 409, 'Un compte existe déjà avec cet email.');
  const id = A.uuid();
  await run('INSERT INTO users (id,email,password_hash,nom,prenom,telephone,asso_type,role,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, mail, A.hash(password), nom || '', prenom || '', telephone || '', asso_type || '', 'admin', 'pending', nowIso()]);
  res.json({ data: { id, email: mail, role: 'admin', status: 'pending' }, error: null });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const u = await get('SELECT * FROM users WHERE email = ?', [String(email || '').toLowerCase()]);
  if (!u || !A.verify(password, u.password_hash)) return bad(res, 401, 'Email ou mot de passe incorrect.');
  const profile = A.publicProfile(u);
  const canLogin = u.status === 'active' || u.role === 'super_admin';
  if (!canLogin) return res.json({ data: { token: null, profile }, error: null });
  const token = A.signToken(u);
  A.setAuthCookie(res, token);
  res.json({ data: { token, profile }, error: null });
});

app.post('/api/auth/logout', (req, res) => { A.clearAuthCookie(res); res.json({ data: true, error: null }); });

app.get('/api/auth/me', A.requireUser, (req, res) => res.json({ data: A.publicProfile(req.user), error: null }));

app.put('/api/auth/profile', A.requireUser, async (req, res) => {
  const { nom, prenom, telephone } = req.body || {};
  await run('UPDATE users SET nom=?, prenom=?, telephone=? WHERE id=?',
    [nom ?? req.user.nom, prenom ?? req.user.prenom, telephone ?? req.user.telephone, req.user.id]);
  res.json({ data: A.publicProfile({ ...req.user, nom, prenom, telephone }), error: null });
});

app.post('/api/auth/password', A.requireUser, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!A.verify(currentPassword, req.user.password_hash)) return bad(res, 403, 'Mot de passe actuel incorrect.');
  if (!newPassword || String(newPassword).length < 6) return bad(res, 400, 'Le nouveau mot de passe doit faire au moins 6 caractères.');
  await run('UPDATE users SET password_hash=? WHERE id=?', [A.hash(newPassword), req.user.id]);
  res.json({ data: true, error: null });
});

/* ---------- Gestion des comptes admin (Super Admin) ---------- */
app.get('/api/admins', A.requireUser, A.requireSuper, async (_req, res) => {
  const rows = await all("SELECT * FROM users WHERE role != 'super_admin' ORDER BY created_at DESC");
  res.json({ data: rows.map(A.publicProfile), error: null });
});

app.post('/api/admins', A.requireUser, A.requireSuper, async (req, res) => {
  const { email, password, nom, prenom, telephone, asso_type, status } = req.body || {};
  if (!email || !password) return bad(res, 400, 'Email et mot de passe requis.');
  const mail = String(email).toLowerCase();
  if (await get('SELECT id FROM users WHERE email = ?', [mail])) return bad(res, 409, 'Un compte existe déjà avec cet email.');
  const id = A.uuid();
  await run('INSERT INTO users (id,email,password_hash,nom,prenom,telephone,asso_type,role,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, mail, A.hash(password), nom || '', prenom || '', telephone || '', asso_type || '', 'admin', status || 'active', nowIso()]);
  res.json({ data: { id, email: mail, role: 'admin', status: status || 'active' }, error: null });
});

app.patch('/api/admins/:id', A.requireUser, A.requireSuper, async (req, res) => {
  const target = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return bad(res, 404, 'Compte introuvable.');
  if (target.role === 'super_admin') return bad(res, 403, 'Operation interdite sur le Super Admin.');
  const { nom, prenom, telephone, asso_type, status, password } = req.body || {};
  await run('UPDATE users SET nom=?, prenom=?, telephone=?, asso_type=?, status=? WHERE id=?',
    [nom ?? target.nom, prenom ?? target.prenom, telephone ?? target.telephone, asso_type ?? target.asso_type, status ?? target.status, target.id]);
  if (password) await run('UPDATE users SET password_hash=? WHERE id=?', [A.hash(password), target.id]);
  res.json({ data: true, error: null });
});

app.delete('/api/admins/:id', A.requireUser, A.requireSuper, async (req, res) => {
  const target = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return bad(res, 404, 'Compte introuvable.');
  if (target.role === 'super_admin') return bad(res, 403, 'Impossible de supprimer le Super Admin.');
  for (const key of ENTITY_KEYS) await run(`DELETE FROM "${key}" WHERE admin_id = ?`, [target.id]);
  await run('DELETE FROM users WHERE id = ?', [target.id]);
  res.json({ data: true, error: null });
});

/* ---------- CRUD générique des entités ---------- */
function validEntity(res, key) { if (!ENTITIES[key]) { bad(res, 404, 'Entité inconnue.'); return false; } return true; }

app.get('/api/:entity', A.requireUser, async (req, res) => {
  const key = req.params.entity; if (!validEntity(res, key)) return;
  const cols = ENTITIES[key].cols;
  const isSuper = req.user.role === 'super_admin';
  let sql = `SELECT * FROM "${key}"`;
  const args = [];
  const where = [];
  if (!isSuper) { where.push('admin_id = ?'); args.push(req.user.id); }
  // Filtre exact col=val
  if (req.query.col && cols[req.query.col]) { where.push(`"${req.query.col}" = ?`); args.push(toSqlArg(req.query.val, cols[req.query.col])); }
  // Recherche (colonnes texte)
  if (req.query.search) {
    const textCols = Object.entries(cols).filter(([, t]) => t === 'text').map(([c]) => c);
    if (textCols.length) where.push('(' + textCols.map(c => `"${c}" LIKE ?`).join(' OR ') + ')');
    const like = '%' + String(req.query.search).toLowerCase() + '%';
    textCols.forEach(() => args.push(like));
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  // Tri
  let sort = req.query.sort && cols[req.query.sort] ? req.query.sort : 'created_at';
  const dir = String(req.query.dir).toLowerCase() === 'asc' ? 'ASC' : (sort === 'created_at' ? 'DESC' : 'ASC');
  sql += ` ORDER BY "${sort}" ${dir}`;
  // Pagination
  const limit = Math.min(parseInt(req.query.limit) || 0, 5000);
  if (limit > 0) { const page = Math.max(parseInt(req.query.page) || 1, 1); sql += ` LIMIT ${limit} OFFSET ${(page - 1) * limit}`; }
  const rows = await all(sql, args);
  res.json({ data: rows.map(r => fromRow(r, cols)), error: null });
});

app.post('/api/:entity', A.requireUser, async (req, res) => {
  const key = req.params.entity; if (!validEntity(res, key)) return;
  const cols = ENTITIES[key].cols, body = req.body || {};
  const isSuper = req.user.role === 'super_admin';
  const adminId = isSuper ? (body.admin_id || req.user.id) : req.user.id;
  const names = Object.keys(cols), values = names.map(c => toSqlArg(body[c], cols[c]));
  const id = A.uuid();
  await run(`INSERT INTO "${key}" (id, admin_id, created_at, ${names.map(c => `"${c}"`).join(', ')}) VALUES (${Array(names.length + 3).fill('?').join(', ')})`,
    [id, adminId, nowIso(), ...values]);
  res.json({ data: { id, admin_id: adminId, created_at: nowIso() }, error: null });
});

app.put('/api/:entity/:id', A.requireUser, async (req, res) => {
  const key = req.params.entity; if (!validEntity(res, key)) return;
  const cols = ENTITIES[key].cols, body = req.body || {};
  const isSuper = req.user.role === 'super_admin';
  const names = Object.keys(cols).filter(c => body[c] !== undefined);
  if (!names.length) return res.json({ data: true, error: null });
  const sets = names.map(c => `"${c}" = ?`).join(', ');
  const args = names.map(c => toSqlArg(body[c], cols[c]));
  args.push(req.params.id);
  const scope = isSuper ? '' : ' AND admin_id = ?';
  if (!isSuper) args.push(req.user.id);
  await run(`UPDATE "${key}" SET ${sets} WHERE id = ?${scope}`, args);
  res.json({ data: true, error: null });
});

app.delete('/api/:entity/:id', A.requireUser, async (req, res) => {
  const key = req.params.entity; if (!validEntity(res, key)) return;
  const isSuper = req.user.role === 'super_admin';
  const args = [req.params.id]; const scope = isSuper ? '' : ' AND admin_id = ?';
  if (!isSuper) args.push(req.user.id);
  await run(`DELETE FROM "${key}" WHERE id = ?${scope}`, args);
  res.json({ data: true, error: null });
});

/* ---------- Sauvegarde / restauration (JSON) ---------- */
app.get('/api/backup/all', A.requireUser, async (req, res) => {
  const isSuper = req.user.role === 'super_admin';
  const out = {};
  for (const key of ENTITY_KEYS) {
    const cols = ENTITIES[key].cols;
    const rows = isSuper ? await all(`SELECT * FROM "${key}"`)
      : await all(`SELECT * FROM "${key}" WHERE admin_id = ?`, [req.user.id]);
    out[key] = rows.map(r => fromRow(r, cols));
  }
  res.json({ data: { version: 3, exported_at: nowIso(), entities: out }, error: null });
});

app.post('/api/backup/restore', A.requireUser, async (req, res) => {
  const isSuper = req.user.role === 'super_admin';
  const data = (req.body && req.body.entities) || {};
  for (const key of ENTITY_KEYS) {
    const cols = ENTITIES[key].cols; const rows = Array.isArray(data[key]) ? data[key] : [];
    if (!isSuper) await run(`DELETE FROM "${key}" WHERE admin_id = ?`, [req.user.id]);
    for (const r of rows) {
      const names = Object.keys(cols);
      const adminId = isSuper ? (r.admin_id || req.user.id) : req.user.id;
      const values = names.map(c => toSqlArg(r[c], cols[c]));
      await run(`INSERT INTO "${key}" (id, admin_id, created_at, ${names.map(c => `"${c}"`).join(', ')}) VALUES (${Array(names.length + 3).fill('?').join(', ')})`,
        [r.id || A.uuid(), adminId, r.created_at || nowIso(), ...values]);
    }
  }
  res.json({ data: true, error: null });
});

/* ---------- 404 API ---------- */
app.use('/api', (_req, res) => bad(res, 404, 'Route API inconnue.'));

/* ---------- Démarrage ---------- */
async function seedSuperAdmin() {
  const mail = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@tripa.com').toLowerCase();
  const existing = await get("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
  if (existing) return;
  await run('INSERT INTO users (id,email,password_hash,nom,prenom,role,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
    [A.uuid(), mail, A.hash(process.env.SUPER_ADMIN_PASSWORD || 'tripa-super-2026'), 'Super', 'Admin', 'super_admin', 'active', nowIso()]);
  console.log('Super Admin créé :', mail);
}

const PORT = process.env.PORT || 10000;
(async () => {
  try {
    await init();
    await seedSuperAdmin();
    app.listen(PORT, () => console.log(`TRIPA prêt sur http://localhost:${PORT} (racine web: ${path.basename(webRoot)})`));
  } catch (e) {
    console.error('Échec du démarrage :', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
