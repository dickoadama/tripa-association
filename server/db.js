/* TRIPA — Accès base de données (Turso libSQL en prod, fichier SQLite local en dev). */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');
const { ENTITIES, ENTITY_KEYS } = require('./schema');

// En l'absence d'URL Turso, on retombe sur un fichier local (pratique pour tester sans compte).
const url = process.env.TURSO_DATABASE_URL || null;
let connection;
if (url) {
  connection = { url, authToken: process.env.TURSO_AUTH_TOKEN || '' };
} else {
  const dir = path.join(__dirname, 'data');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  connection = { url: 'file:' + path.join(dir, 'tripa.db') };
}

const client = createClient(connection);

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

async function all(sql, args = []) { const r = await client.execute({ sql, args }); return r.rows; }
async function get(sql, args = []) { const r = await client.execute({ sql, args }); return r.rows[0] || null; }
async function run(sql, args = []) { return client.execute({ sql, args }); }

async function init() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    nom TEXT DEFAULT '', prenom TEXT DEFAULT '', telephone TEXT DEFAULT '',
    asso_type TEXT DEFAULT '', role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL)`);

  for (const key of ENTITY_KEYS) {
    const cols = ENTITIES[key].cols;
    const defs = Object.entries(cols).map(([c, t]) => {
      const sqlType = t === 'num' ? 'REAL' : (t === 'bool' ? 'INTEGER' : 'TEXT');
      return `"${c}" ${sqlType}`;
    }).join(', ');
    await run(`CREATE TABLE IF NOT EXISTS "${key}" (
      id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, created_at TEXT NOT NULL, ${defs})`);
    await run(`CREATE INDEX IF NOT EXISTS idx_${key}_admin ON "${key}"(admin_id)`);
  }
}

module.exports = { client, all, get, run, init, toSqlArg, fromRow, ENTITIES, ENTITY_KEYS };
