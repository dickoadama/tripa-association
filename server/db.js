/* TRIPA — Accès base de données.
 * Backends supportés, sélectionnés dans cet ordre de priorité :
 *   1) DATABASE_URL ou SUPABASE_DB_URL → Postgres (Supabase — recommandé en production)
 *   2) TURSO_DATABASE_URL              → Turso (libSQL)
 *   3) (rien de configuré)             → fichier SQLite local server/data/tripa.db (dev / auto-hébergement)
 * L'API exposée (all/get/run, placeholders "?") reste identique quel que soit le backend. */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { ENTITIES, ENTITY_KEYS } = require('./schema');

const pgUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
const tursoUrl = process.env.TURSO_DATABASE_URL || null;

let pool = null;   // pg.Pool (Postgres)
let client = null; // client libSQL (Turso ou fichier local)

if (pgUrl) {
  const { Pool } = require('pg');
  const cfg = { max: 5 };
  try {
    // Analyse manuelle de l'URL : Supabase y ajoute des paramètres (channel-binding…)
    // que le driver pg ne connaît pas et qui feraient échouer la connexion.
    const u = new URL(pgUrl);
    cfg.host = u.hostname;
    cfg.port = Number(u.port) || 5432;
    cfg.user = decodeURIComponent(u.username);
    cfg.password = decodeURIComponent(u.password);
    cfg.database = u.pathname.replace(/^\//, '') || 'postgres';
    // TLS toujours actif. La vérification du certificat est STRicte par défaut.
    // Les projets Supabase utilisent parfois une chaîne de certification intermédiaire
    // absente des magasins CA d'Ubuntu/Alpine : si la connexion échoue sur ce point,
    // définir DB_SSL_INSECURE=true (trafic quand même chiffré, seul le contrôle de
    // l'autorité émettrice est désactivé, et uniquement pour les hôtes *.supabase.com).
    const insecureHost = process.env.DB_SSL_INSECURE === 'true' && /\.supabase\.com$/i.test(cfg.host);
    cfg.ssl = insecureHost ? { rejectUnauthorized: false } : true;
  } catch (e) {
    cfg.connectionString = pgUrl;
  }
  pool = new Pool(cfg);
} else if (tursoUrl) {
  client = require('@libsql/client').createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN || '' });
} else {
  const dir = path.join(__dirname, 'data');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  client = require('@libsql/client').createClient({ url: 'file:' + path.join(dir, 'tripa.db') });
}

const isPg = !!pool;
const backend = isPg ? 'postgres' : (tursoUrl ? 'turso' : 'sqlite');

// Postgres numérote ses paramètres ($1, $2…) : on convertit les "?" utilisés dans toute l'app.
function toPgSql(sql) { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); }

function toSqlArg(v, type) {
  if (v === undefined || v === null) return null;
  if (type === 'bool') return (v === true || v === 'true' || v === 1 || v === '1') ? 1 : 0;
  if (type === 'num') { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return String(v);
}
function fromRow(row, cols) {
  const out = {};
  for (const [k, t] of Object.entries(cols)) {
    out[k] = row[k] === null || row[k] === undefined ? (t === 'bool' ? false : (t === 'num' ? null : ''))
      : (t === 'bool' ? !!row[k] : row[k]);
  }
  out.id = row.id; out.admin_id = row.admin_id; out.created_at = row.created_at;
  return out;
}

async function all(sql, args = []) {
  if (isPg) { const r = await pool.query(toPgSql(sql), args); return r.rows; }
  const r = await client.execute({ sql, args }); return r.rows;
}
async function get(sql, args = []) { const rows = await all(sql, args); return rows[0] || null; }
async function run(sql, args = []) {
  if (isPg) { const r = await pool.query(toPgSql(sql), args); return { rows: r.rows }; }
  return client.execute({ sql, args });
}

// Types de colonnes selon le backend (bool stocké en 0/1 INTEGER partout, idem toSqlArg).
function sqlType(t) {
  if (t === 'num') return isPg ? 'DOUBLE PRECISION' : 'REAL';
  if (t === 'bool') return 'INTEGER';
  return 'TEXT';
}

async function init() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    nom TEXT DEFAULT '', prenom TEXT DEFAULT '', telephone TEXT DEFAULT '',
    asso_type TEXT DEFAULT '', role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL)`);

  for (const key of ENTITY_KEYS) {
    const cols = ENTITIES[key].cols;
    const defs = Object.entries(cols).map(([c, t]) => `"${c}" ${sqlType(t)}`).join(', ');
    await run(`CREATE TABLE IF NOT EXISTS "${key}" (
      id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, created_at TEXT NOT NULL, ${defs})`);
    await run(`CREATE INDEX IF NOT EXISTS idx_${key}_admin ON "${key}"(admin_id)`);
  }

  await run(`CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, action TEXT NOT NULL,
    entity TEXT NOT NULL DEFAULT '', label TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_activity_admin ON activity_log(admin_id)`);
}

module.exports = { client, pool, all, get, run, init, toSqlArg, fromRow, ENTITIES, ENTITY_KEYS, backend };
