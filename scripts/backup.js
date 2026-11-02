#!/usr/bin/env node
/* TRIPA — Sauvegarde automatisée (DB-agnostique : SQLite local OU Turso).
 * Réutilise server/db.js → aucun accès HTTP ni jeton requis.
 * - Dump JSON : entités (forme = /api/backup/all, rechargeable via l'UI Restauration) + comptes users.
 * - Capture binaire SQLite via VACUUM INTO quand backend local (snapshot cohérent, WAL inclus).
 * - Chiffrement optionnel AU REPOS : AES-256-GCM, clé dérivée (scrypt) d'une passphrase.
 * - Rétention : garde les N derniers horodatages (BACKUP_KEEP), supprime les lots plus anciens.
 *
 * Variables : BACKUP_DIR (défaut ./backups), BACKUP_KEEP (défaut 14),
 *             BACKUP_REDACT_SECRETS=true → omettre les empreintes de mot de passe,
 *             BACKUP_ENCRYPT=true → chiffrer (nécessite BACKUP_PASSPHRASE ou BACKUP_PASSPHRASE_FILE).
 * Déchiffrement (pour restaurer) : node scripts/backup.js --decrypt <fichier.enc> [sortie] */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
try { require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') }); } catch (e) {}

const MAGIC = 'TRIPAEN1'; // en-tête format fichier chiffré
const OUT = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP = Math.max(1, parseInt(process.env.BACKUP_KEEP || '14', 10) || 14);
const REDACT = process.env.BACKUP_REDACT_SECRETS === 'true';
const ENCRYPT = process.env.BACKUP_ENCRYPT === 'true';

function getPassphrase() {
  let p = '';
  if (process.env.BACKUP_PASSPHRASE_FILE) {
    try { p = fs.readFileSync(process.env.BACKUP_PASSPHRASE_FILE, 'utf8').replace(/\r?\n$/, ''); }
    catch (e) { throw new Error('BACKUP_PASSPHRASE_FILE illisible : ' + e.message); }
  }
  if (!p) p = process.env.BACKUP_PASSPHRASE || '';
  if (!p) throw new Error('BACKUP_ENCRYPT=true exige BACKUP_PASSPHRASE (ou BACKUP_PASSPHRASE_FILE).');
  return p;
}

function encryptBuffer(buf, passphrase) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([Buffer.from(MAGIC, 'ascii'), salt, iv, c.getAuthTag(), ct]);
}

function decryptBuffer(data, passphrase) {
  if (data.slice(0, MAGIC.length).toString('ascii') !== MAGIC) throw new Error('format non reconnu (fichier chiffré ?)');
  let p = MAGIC.length;
  const salt = data.slice(p, p + 16); p += 16;
  const iv = data.slice(p, p + 12); p += 12;
  const tag = data.slice(p, p + 16); p += 16;
  const ct = data.slice(p);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

function stamp() { return new Date().toISOString().replace('T', '_').replace(/[:.]/g, '-').slice(0, 19); }

function prune(dir) {
  const files = fs.readdirSync(dir).filter(f => f.startsWith('tripa-backup-'));
  const stamps = [...new Set(files.map(f => f.replace(/^tripa-backup-/, '').replace(/\.(json|db)(\.enc)?$/, '')))].sort();
  const excess = stamps.length - KEEP;
  if (excess <= 0) return;
  stamps.slice(0, excess).forEach(s => {
    ['.json', '.json.enc', '.db', '.db.enc'].forEach(ext => { try { fs.unlinkSync(path.join(dir, 'tripa-backup-' + s + ext)); } catch (e) {} });
  });
  console.log(`[backup] rétention : ${excess} ancien(s) lot(s) supprimé(s) (garde = ${KEEP}).`);
}

/* ----- Mode déchiffrement (restauration) ----- */
const argv = process.argv.slice(2);
if (argv[0] === '--decrypt') {
  const inp = argv[1], outp = argv[2] || inp.replace(/\.enc$/, '');
  if (!inp) { console.error('Usage : node scripts/backup.js --decrypt <fichier.enc> [sortie]'); process.exit(2); }
  try {
    fs.writeFileSync(outp, decryptBuffer(fs.readFileSync(inp), getPassphrase()));
    console.log('[decrypt] ' + outp);
  } catch (e) { console.error('[decrypt] ÉCHEC : ' + (e && e.message ? e.message : e)); process.exit(1); }
  process.exit(0);
}

/* ----- Mode sauvegarde ----- */
const { init, all, fromRow, ENTITIES, ENTITY_KEYS, client } = require('../server/db');

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
    encrypted: ENCRYPT,
    counts: Object.assign({ users: users.length }, Object.fromEntries(ENTITY_KEYS.map(k => [k, entities[k].length]))),
    users, entities
  };

  const pass = ENCRYPT ? getPassphrase() : null;
  fs.mkdirSync(OUT, { recursive: true });
  const base = path.join(OUT, 'tripa-backup-' + stamp());

  const jsonBuf = Buffer.from(JSON.stringify(payload, null, 2));
  if (ENCRYPT) { fs.writeFileSync(base + '.json.enc', encryptBuffer(jsonBuf, pass)); console.log('[backup] JSON chiffré : ' + base + '.json.enc (' + fs.statSync(base + '.json.enc').size + ' o)'); }
  else { fs.writeFileSync(base + '.json', jsonBuf); console.log(`[backup] JSON : ${base}.json (${jsonBuf.length} o · ${payload.counts.users} comptes, ${ENTITY_KEYS.reduce((a, k) => a + entities[k].length, 0)} lignes)`); }

  if (!process.env.TURSO_DATABASE_URL) {
    try {
      await client.execute({ sql: 'VACUUM INTO ?', args: [base + '.db'] });
      if (ENCRYPT) { fs.writeFileSync(base + '.db.enc', encryptBuffer(fs.readFileSync(base + '.db'), pass)); fs.unlinkSync(base + '.db'); console.log('[backup] SQLite chiffrée : ' + base + '.db.enc'); }
      else console.log('[backup] SQLite : ' + base + '.db');
    } catch (e) { console.warn('[backup] capture binaire ignorée (' + (e && e.message ? e.message : e) + ')'); }
  }

  prune(OUT);
  console.log('[backup] terminé.');
})().catch(e => { console.error('[backup] ÉCHEC : ' + (e && e.message ? e.message : e)); process.exit(1); });
