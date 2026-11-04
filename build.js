/* TRIPA — Build frontend : copie les fichiers de la racine → dist/ en minifiant JS et CSS.
 * - Terser avec mangle:false : préserve les noms de fonctions globales partagées
 *   entre les <script> classiques (fetchAll, esc, ENTITY_SCHEMA, openForm...).
 * - Clean-CSS : compacte le CSS.
 * Le dossier dist/ obtenu est un site 100 % statique, publiable tel quel
 * (GitHub Pages, Netlify, n'importe quel hébergeur statique). */
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const SRC = __dirname; // fichiers source à la racine du projet
const OUT = path.join(__dirname, 'dist');

// Fichiers et dossiers frontend à copier (exclut node_modules/, backups/, dist/…)
const FRONTEND_ITEMS = [
  'index.html', 'register.html', 'dashboard.html', 'entity.html',
  'settings.html', 'profile.html', 'help.html', 'activity.html',
  'css', 'js', 'icons', 'sw.js', 'manifest.webmanifest'
];

function copyItem(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      copyItem(path.join(src, entry.name), path.join(dest, entry.name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function walk(dir, fn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, fn);
    else await fn(p);
  }
}

(async () => {
  try { fs.rmSync(OUT, { recursive: true, force: true }); } catch (e) {}
  for (const item of FRONTEND_ITEMS) {
    const src = path.join(SRC, item);
    if (!fs.existsSync(src)) continue;
    copyItem(src, path.join(OUT, item));
  }

  let jsCount = 0, cssCount = 0;
  await walk(OUT, async (file) => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.js') {
      const code = fs.readFileSync(file, 'utf8');
      const res = await minify(code, { mangle: false, compress: true, format: { comments: false } });
      if (res && res.code) { fs.writeFileSync(file, res.code); jsCount++; }
    } else if (ext === '.css') {
      const out = new CleanCSS({ level: 2 }).minify(fs.readFileSync(file, 'utf8'));
      if (out && out.styles) { fs.writeFileSync(file, out.styles); cssCount++; }
    }
  });
  console.log(`Build terminé : ${jsCount} fichier(s) JS et ${cssCount} CSS minifiés dans dist/`);
})().catch((e) => { console.error('Échec du build :', e && e.message ? e.message : e); process.exit(1); });
