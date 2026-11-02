/* ==========================================
   TRIPA — Backend Express + SQLite
   API REST : authentification, comptes admin,
   et CRUD multi-tenant pour les 8 tables métier.
   Démarrage :  npm install  puis  npm start
   ========================================== */

const express = require('express');
const cors = require('cors');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Charge un éventuel fichier .env (server/.env ou racine du projet).
// Le .env n'est JAMAIS commité — il stocke les secrets locaux.
for (const envFile of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env')]) {
  try {
    if (fs.existsSync(envFile)) {
      for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && process.env[m[1]] === undefined) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
      break;
    }
  } catch (e) { /* .env illisible : on continue avec les variables du système */ }
}

// ==========================================
// Sécurité : le mot de passe du Super Admin ne figure PAS dans le code.
// Sans SUPER_ADMIN_PWD défini (variable d'environnement ou .env),
// le serveur REFUSE de démarrer.
// ==========================================
if (!process.env.SUPER_ADMIN_PWD) {
  console.error('❌ TRIPA refuse de démarrer : SUPER_ADMIN_PWD n\'est pas défini.');
  console.error('   Créez un fichier server/.env contenant :');
  console.error('     SUPER_ADMIN_EMAIL=superadmin@tripa.com');
  console.error('     SUPER_ADMIN_PWD=votre-mot-de-passe-fort');
  console.error('   ... ou exportez ces variables avant de lancer le serveur.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@tripa.com').toLowerCase();
const SUPER_ADMIN_DEFAULT_PWD = process.env.SUPER_ADMIN_PWD;
// Chemin de la base — à pointer vers un disque persistant lors d'un déploiement en ligne
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'tripa.db');

// ==========================================
// Base de données (créée au premier lancement)
// ==========================================
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  asso_type TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','super_admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','rejected')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT, phone TEXT,
  role TEXT NOT NULL DEFAULT 'membre',
  status TEXT NOT NULL DEFAULT 'actif',
  join_date TEXT, note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finances (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('revenu','depense')),
  category TEXT,
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  member_id TEXT,
  date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'ordinaire',
  description TEXT, location TEXT,
  start_at TEXT NOT NULL, end_at TEXT,
  attendees INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planifiee',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT, location TEXT,
  event_date TEXT NOT NULL, event_time TEXT,
  budget REAL,
  status TEXT NOT NULL DEFAULT 'planifie',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  question TEXT NOT NULL,
  description TEXT,
  options TEXT NOT NULL DEFAULT '["Pour","Contre","Abstention"]',
  results TEXT NOT NULL DEFAULT '{}',
  opens_at TEXT, closes_at TEXT,
  status TEXT NOT NULL DEFAULT 'ouvert',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT 'Administration',
  subject TEXT NOT NULL,
  body TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT, size_label TEXT, storage_path TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'a_faire',
  progress INTEGER DEFAULT 0,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Seed : le Super Admin
const superExists = db.prepare('SELECT id FROM users WHERE email = ?').get(SUPER_ADMIN_EMAIL);
if (!superExists) {
  db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, role, status)
              VALUES (?, ?, ?, 'Super', 'Admin', 'super_admin', 'active')`)
    .run(crypto.randomUUID(), SUPER_ADMIN_EMAIL, bcrypt.hashSync(SUPER_ADMIN_DEFAULT_PWD, 10));
  console.log(`✅ Super Admin créé — email : ${SUPER_ADMIN_EMAIL} (mot de passe : celui de SUPER_ADMIN_PWD)`);
  console.log('   ⚠️ Changez ce mot de passe après la première connexion.');
}

// ==========================================
// Métadonnées des tables métier
// ==========================================
const TABLES = {
  members:    ['first_name', 'last_name', 'email', 'phone', 'role', 'status', 'join_date', 'note'],
  finances:   ['type', 'category', 'description', 'amount', 'member_id', 'date'],
  meetings:   ['title', 'category', 'description', 'location', 'start_at', 'end_at', 'attendees', 'status'],
  events:     ['title', 'description', 'location', 'event_date', 'event_time', 'budget', 'status'],
  votes:      ['question', 'description', 'options', 'results', 'opens_at', 'closes_at', 'status'],
  messages:   ['sender', 'subject', 'body', 'is_read'],
  documents:  ['name', 'category', 'size_label', 'storage_path'],
  projects:   ['title', 'description', 'status', 'progress', 'due_date']
};
const JSON_COLS = { votes: ['options', 'results'] };

// ==========================================
// App + middlewares
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());
// Sert aussi l'application (index.html, css/, js/...) sur http://localhost:3000
app.use(express.static(path.join(__dirname, '..')));

// Les réponses /api dépendent de l'authentification : aucun cache navigateur
// (évite les 304 qui rejouent des payloads obsolètes ou des 401 → fausses déconnexions)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  next();
});

function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      if (!required) return next();
      return res.status(401).json({ error: { message: 'Authentification requise.' } });
    }
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
    const user = session && db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
    if (!user) return res.status(401).json({ error: { message: 'Session invalide ou expirée.' } });
    req.user = user;
    req.token = token;
    next();
  };
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: { message: 'Accès réservé au Super Admin.' } });
  }
  next();
}

// Sérialisation / désérialisation des colonnes JSON
// + conversion des booléens en 1/0 (node:sqlite ne bind pas les booléens)
function toSqliteValue(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}
function serialize(table, obj) {
  const out = { ...obj };
  for (const col of (JSON_COLS[table] || [])) {
    if (out[col] !== undefined && typeof out[col] !== 'string') out[col] = JSON.stringify(out[col]);
  }
  for (const col of Object.keys(out)) {
    out[col] = toSqliteValue(out[col]);
  }
  return out;
}
function deserialize(table, row) {
  if (!row) return row;
  const out = { ...row };
  for (const col of (JSON_COLS[table] || [])) {
    if (typeof out[col] === 'string') { try { out[col] = JSON.parse(out[col]); } catch (e) { /* garde la chaîne */ } }
  }
  return out;
}

// ==========================================
// Routes d'authentification
// ==========================================

// Inscription (nouvel admin → statut « pending »)
app.post('/api/auth/register', (req, res) => {
  const { email, password, first_name, last_name, phone, asso_type } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: { message: 'Email et mot de passe requis.' } });
  if (String(email).toLowerCase() === SUPER_ADMIN_EMAIL) {
    return res.status(403).json({ error: { message: 'Cette adresse email est réservée.' } });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: { message: 'Un compte existe déjà avec cette adresse email.' } });

  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, phone, asso_type, role, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', 'pending')`)
    .run(id, String(email).toLowerCase(), bcrypt.hashSync(password, 10),
         first_name || '', last_name || '', phone || '', asso_type || '');
  res.status(201).json({ data: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

// Connexion — renvoie un token uniquement si le compte est actif
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: { message: 'Email ou mot de passe incorrect.' } });
  }
  let token = null;
  if (user.status === 'active') {
    token = crypto.randomUUID();
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  }
  res.json({ data: { token, profile: publicUser(user) } });
});

app.get('/api/auth/me', auth(), (req, res) => {
  res.json({ data: publicUser(req.user) });
});

app.post('/api/auth/logout', auth(false), (req, res) => {
  if (req.token) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.json({ data: true });
});

// ==========================================
// Gestion des comptes (Super Admin uniquement)
// ==========================================
app.get('/api/admin/users', auth(), requireSuperAdmin, (req, res) => {
  const rows = db.prepare(`SELECT * FROM users WHERE role != 'super_admin' ORDER BY created_at DESC`).all();
  res.json({ data: rows.map(publicUser) });
});

app.post('/api/admin/users', auth(), requireSuperAdmin, (req, res) => {
  const { email, password, first_name, last_name, phone, asso_type, status } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: { message: 'Email et mot de passe requis.' } });
  if (String(email).toLowerCase() === SUPER_ADMIN_EMAIL) {
    return res.status(403).json({ error: { message: 'Adresse réservée au Super Admin.' } });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: { message: 'Un compte existe déjà avec cette email.' } });

  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, phone, asso_type, role, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', ?)`)
    .run(id, String(email).toLowerCase(), bcrypt.hashSync(password, 10),
         first_name || '', last_name || '', phone || '', asso_type || '', status || 'active');
  res.status(201).json({ data: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

app.patch('/api/admin/users/:id', auth(), requireSuperAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: { message: 'Compte introuvable.' } });

  const updates = {};
  for (const col of ['first_name', 'last_name', 'phone', 'asso_type', 'status']) {
    if (req.body[col] !== undefined) updates[col] = req.body[col];
  }
  if (req.body.password) updates.password_hash = bcrypt.hashSync(String(req.body.password), 10);

  const keys = Object.keys(updates);
  if (keys.length) {
    db.prepare(`UPDATE users SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map(k => updates[k]), user.id);
  }
  res.json({ data: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});

app.delete('/api/admin/users/:id', auth(), requireSuperAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: { message: 'Compte introuvable.' } });
  if (user.role === 'super_admin') return res.status(403).json({ error: { message: 'Impossible de supprimer le Super Admin.' } });

  try {
    db.exec('BEGIN');
    for (const table of Object.keys(TABLES)) {
      db.prepare(`DELETE FROM ${table} WHERE admin_id = ?`).run(user.id);
    }
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: { message: e.message } });
  }
  res.json({ data: true });
});

// Changement de son propre mot de passe (tout utilisateur connecté)
app.post('/api/auth/change-password', auth(), (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!bcrypt.compareSync(current_password || '', req.user.password_hash)) {
    return res.status(403).json({ error: { message: 'Mot de passe actuel incorrect.' } });
  }
  if (!new_password || String(new_password).length < 6) {
    return res.status(400).json({ error: { message: 'Le nouveau mot de passe doit faire au moins 6 caractères.' } });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(String(new_password), 10), req.user.id);
  res.json({ data: true });
});

// ==========================================
// CRUD générique multi-tenant
//   admin  : ne voit/manipule que ses lignes
//   super  : voit tout (lecture), n'édite que son périmètre
// ==========================================

function scopeClause(req) {
  return req.user.role === 'super_admin' ? null : req.user.id;
}

app.get('/api/:table', auth(), (req, res) => {
  const table = req.params.table;
  if (!TABLES[table]) return res.status(404).json({ error: { message: 'Table inconnue.' } });

  const where = [];
  const params = [];
  const adminId = scopeClause(req);
  if (adminId) { where.push('admin_id = ?'); params.push(adminId); }

  // Filtres d'égalité : ?col=valeur (colonnes blanchelistées)
  for (const [key, value] of Object.entries(req.query)) {
    if (['order', 'dir', 'limit'].includes(key)) continue;
    if (TABLES[table].includes(key)) { where.push(`${key} = ?`); params.push(value); }
  }

  let sql = `SELECT * FROM ${table}`;
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  const orderCol = TABLES[table].includes(req.query.order) ? req.query.order : 'created_at';
  const orderDir = String(req.query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${orderCol} ${orderDir}`;
  if (req.query.limit) sql += ` LIMIT ${Math.max(1, parseInt(req.query.limit, 10) || 100)}`;

  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows.map(r => deserialize(table, r)) });
});

app.post('/api/:table', auth(), (req, res) => {
  const table = req.params.table;
  if (!TABLES[table]) return res.status(404).json({ error: { message: 'Table inconnue.' } });

  const row = serialize(table, req.body || {});
  const cols = TABLES[table].filter(c => row[c] !== undefined);
  const id = crypto.randomUUID();
  const adminId = scopeClause(req) || row.admin_id || req.user.id;

  const allCols = ['id', 'admin_id', ...cols];
  const values = [id, adminId, ...cols.map(c => row[c])];
  try {
    db.prepare(`INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${allCols.map(() => '?').join(', ')})`)
      .run(...values);
  } catch (e) {
    return res.status(400).json({ error: { message: e.message } });
  }
  const created = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  res.status(201).json({ data: deserialize(table, created) });
});

app.patch('/api/:table/:id', auth(), (req, res) => {
  const table = req.params.table;
  if (!TABLES[table]) return res.status(404).json({ error: { message: 'Table inconnue.' } });

  const adminId = scopeClause(req);
  const existing = adminId
    ? db.prepare(`SELECT * FROM ${table} WHERE id = ? AND admin_id = ?`).get(req.params.id, adminId)
    : db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: { message: 'Ligne introuvable.' } });

  const updates = serialize(table, req.body || {});
  const keys = TABLES[table].filter(c => updates[c] !== undefined);
  if (keys.length) {
    try {
      db.prepare(`UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`)
        .run(...keys.map(k => updates[k]), existing.id);
    } catch (e) {
      return res.status(400).json({ error: { message: e.message } });
    }
  }
  const updated = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(existing.id);
  res.json({ data: deserialize(table, updated) });
});

app.delete('/api/:table/:id', auth(), (req, res) => {
  const table = req.params.table;
  if (!TABLES[table]) return res.status(404).json({ error: { message: 'Table inconnue.' } });

  const adminId = scopeClause(req);
  const info = adminId
    ? db.prepare(`DELETE FROM ${table} WHERE id = ? AND admin_id = ?`).run(req.params.id, adminId)
    : db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: { message: 'Ligne introuvable.' } });
  res.json({ data: true });
});

// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 TRIPA API prête sur http://localhost:${PORT}/api`);
});
