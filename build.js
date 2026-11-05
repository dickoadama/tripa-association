/* TRIPA — Build de publication : copie les fichiers de la racine → dist/ en rendant
 * le code source illisible pour les visiteurs du site publié.
 * - Terser : mangle=true renomme les variables/arguments des portées INTERNES ;
 *   les noms déclarés au premier niveau (globals partagés entre <script> : fetchAll,
 *   esc, ENTITY_SCHEMA, openForm, signOut…) restent intacts (toplevel:false par défaut).
 *   compress: drop_console/drop_debugger suppriment traces et points d'arrêt.
 * - Clean-CSS : compacte le CSS.
 * - HTML : commentaires retirés, whitespace compacté, script garde-fou injecté
 *   (bloque clic droit / F12 / Ctrl+U / Ctrl+Shift+I) — uniquement dans dist/.
 * Le dossier dist/ obtenu est un site 100 % statique, publiable tel quel
 * (GitHub Pages via Actions, Netlify, n'importe quel hébergeur statique). */
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const SRC = __dirname; // fichiers source à la racine du projet
const OUT = path.join(__dirname, 'dist');

// Fichiers et dossiers frontend à copier (exclut node_modules/, backups/, dist/…)
const FRONTEND_ITEMS = [
  'index.html', 'register.html', 'dashboard.html', 'entity.html', 'admin-management.html',
  'settings.html', 'profile.html', 'help.html', 'activity.html',
  'css', 'js', 'icons', 'sw.js', 'manifest.webmanifest'
];

/* Garde-fou injecté dans le HTML publié : dissuade l'inspection du code.
 * (Deterrent honnête : le code d'un site statique reste téléchargeable,
 * mais il sort illisible et ces raccourcis sont neutralisés.) */
const GUARD = '<script>(function(){function no(){var d=document.createElement("div");d.textContent="Le code source de TRIPA est prot\u00e9g\u00e9.";d.setAttribute("style","position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:8px 16px;border-radius:8px;z-index:99999;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3)");document.body.appendChild(d);setTimeout(function(){d.remove()},1800)}document.addEventListener("contextmenu",function(e){e.preventDefault();no()});document.addEventListener("keydown",function(e){var b=e.key==="F12"||(e.ctrlKey&&e.shiftKey&&/^[ijcICJ]$/.test(e.key))||(e.ctrlKey&&!e.shiftKey&&/^[uUsS]$/.test(e.key));if(b){e.preventDefault();e.stopPropagation();no()}});})();</script>';

/* HTML : les blocs <script> inline sont sortis, passés au terser (comme les .js),
 * puis réinjectés — la réduction des newlines ne casse plus les commentaires //
 * ni les littéraux multilignes du script inline de dashboard.html. */
async function minifyHtml(html) {
  const blocks = [];
  html = html.replace(/<script>([\s\S]*?)<\/script>/gi, (m, js) => {
    blocks.push(js);
    return '\u0000SB' + (blocks.length - 1) + '\u0000';
  });
  html = html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')            // commentaires HTML
    .replace(/[ \t]+(\r?\n)[ \t]*/g, '$1')              // indentation inutile
    .replace(/(\r?\n){2,}/g, '\n')                      // lignes blanches
    .replace(/\n/g, ' ')                                // tout sur une ligne
    .replace(/>\s+</g, '><');                           // whitespace entre balises
  for (let i = 0; i < blocks.length; i++) {
    let code = blocks[i];
    try {
      const res = await minify(code, {
        mangle: true,
        compress: { passes: 3, drop_console: true, drop_debugger: true },
        format: { comments: false }
      });
      if (res && res.code) code = res.code;
    } catch (e) { /* bloc refusé par terser : conservé tel quel */ }
    html = html.split('\u0000SB' + i + '\u0000').join('<script>' + code.replace(/<\/script>/gi, '<\\/script>') + '</script>');
  }
  return html.replace(/<\/body>/i, GUARD + '</body>');
}

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

  let jsCount = 0, cssCount = 0, htmlCount = 0;
  await walk(OUT, async (file) => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.js') {
      const code = fs.readFileSync(file, 'utf8');
      const res = await minify(code, {
        mangle: true,
        compress: { passes: 3, drop_console: true, drop_debugger: true },
        format: { comments: false }
      });
      if (res && res.code) { fs.writeFileSync(file, res.code); jsCount++; }
    } else if (ext === '.css') {
      const out = new CleanCSS({ level: 2 }).minify(fs.readFileSync(file, 'utf8'));
      if (out && out.styles) { fs.writeFileSync(file, out.styles); cssCount++; }
    } else if (ext === '.html') {
      fs.writeFileSync(file, await minifyHtml(fs.readFileSync(file, 'utf8'))); htmlCount++;
    }
  });
  console.log(`Build terminé : ${jsCount} JS manglés, ${cssCount} CSS et ${htmlCount} HTML minifiés (+ garde-fou) dans dist/`);
})().catch((e) => { console.error('Échec du build :', e && e.message ? e.message : e); process.exit(1); });
