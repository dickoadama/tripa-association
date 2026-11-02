#!/usr/bin/env node
/* TRIPA — Sauvegarde automatisée (DB-agnostique : SQLite local OU Turso).
 * Réutilise server/db.js → aucun accès HTTP ni jeton requis.
 * - Dump JSON : entités (forme = /api/backup/all, donc rechargeable via l'UI Restauration) + comptes users.
 * - Capture binaire SQLite via VACUUM INTO quand backend local (snapshot cohérent, WAL inclus).
 * - Rétention : garde les N dernières horodatages (BACKUP_KEEP), supprime paires .json/.db plus anciennes.
 * Variables : BACKUP_DIR (défaut ./backups), BACKUP_KEEP (défaut 14),
 *             BACKUP_REDACT_SECRETS=true pour omettre les empreintes de mot de passe. */
const path = require('path');
const fs = require('fs');
try { require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') }); } catch (e) {}
const { init, all, fromRow, ENTITIES, ENTITY_KEYS, client } = require('../server/db');

const OUT = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP = Math.max(1, parseInt(process.env.BACKUP_KEEP || '14', 10) || 14);
const REDACT = process.env.BACKUP_REDACT_SECRETS === 'true';

function stamp() {
  return new Date().toISOString().replace('T', '_').replace(/[:.]/g, '-').slice(0, 19); // 2026-11-02_18-24-23
}

function prune(dir) {
  const files = fs.readdirSync(dir).filter(f => f.startsWith('tripa-backup-'));
  const stamps = [...new Set(files.map(f => f.replace(/^tripa-backup-/, '').replace(/\.(json|db)$/, '')))].sort(); // lexicographique = chronologique (ISO)
  const excess = stamps.length - KEEP;
  if (excess <= 0) return;
  stamps.slice(0, excess).forEach(s => {
    ['.json', '.db'].forEach(ext => { try { fs.unlinkSync(path.join(dir, 'tripa-backup-' + s + ext)); } catch (e) {} });
  });
  console.log(`[backup] rétention : ${excess} ancien(s) lot(s) supprimé(s) (garde = ${KEEP}).`);
}

(async () => {
  await init();
  const entities = {};
  for (const key of ENTITY_KEYS) {
    const cols = ENTITIES[key].cols;
    const rows = await all(`SELECT * FROM "${key}" ORDER BY created_at DESC`);
    entities[key] = rows.map(r => fromRow(r, cols));
  }
  const usersRaw = await all('SELECT * FROM users ORDER BY created_at DESC');
  const users = usersRaw.map(u => { const o = Object.assign({}, u); if (REDACT) o.password_hash = ''; return o; });

  const payload = {
    app: 'TRIPA', version: 3, kind: 'backup',
    created_at: new Date().toISOString(),
    backend: process.env.TURSO_DATABASE_URL ? 'turso' : 'sqlite',
    counts: Object.assign({ users: users.length }, Object.fromEntries(ENTITY_KEYS.map(k => [k, entities[k].length]))),
    users, entities
  };

  fs.mkdirSync(OUT, { recursive: true });
  const base = path.join(OUT, 'tripa-backup-' + stamp());
  const jsonFile = base + '.json';
  fs.writeFileSync(jsonFile, JSON.stringify(payload, null, 2));
  console.log(`[backup] JSON : ${jsonFile} (${fs.statSync(jsonFile).size} o · ${payload.counts.users} comptes, ${ENTITY_KEYS.reduce((a, k) => a + entities[k].length, 0)} lignes)`);

  if (!process.env.TURSO_DATABASE_URL) {
    try { await client.execute({ sql: 'VACUUM INTO ?', args: [base + '.db'] }); console.log('[backup] SQLite : ' + base + '.db'); }
    catch (e) { console.warn('[backup] capture binaire ignorée (' + (e && e.message ? e.message : e) + ')'); }
  }

  prune(OUT);
  console.log('[backup] terminé.');
})().catch(e => { console.error('[backup] ÉCHEC : ' + (e && e.message ? e.message : e)); process.exit(1); });
