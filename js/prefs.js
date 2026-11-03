/* TRIPA — Préférences d'interface (thème, accent, densité, notifications).
 * Chargé tôt dans <head> pour appliquer le thème avant la peinture (anti-FOUC). */
window.TRIPA = window.TRIPA || {};
(function () {
  const KEY = 'tripa_prefs';
  const ACCENTS = {
    indigo: '#4f46e5', blue: '#2563eb', emerald: '#059669',
    violet: '#7c3aed', rose: '#e11d48', amber: '#d97706', cyan: '#0891b2'
  };
  const DEFAULTS = { theme: 'light', accent: 'indigo', density: 'comfortable', notifications: true };

  function get() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  // Résout le thème effectif : 'auto' suit le système d'exploitation.
  function resolve(pref) {
    if (pref === 'auto') return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    return pref === 'dark' ? 'dark' : 'light';
  }
  function apply(p) {
    p = p || get();
    const root = document.documentElement;
    root.setAttribute('data-theme', resolve(p.theme));
    root.setAttribute('data-density', p.density);
    const accent = ACCENTS[p.accent] || p.accent || ACCENTS.indigo;
    root.style.setProperty('--accent', accent);
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', accent));
  }
  function set(patch) {
    const p = Object.assign(get(), patch || {});
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    apply(p);
    return p;
  }
  // Bascule simple clair ⇄ sombre (garée pour compatibilité).
  function toggleTheme() { const p = get(); return set({ theme: resolve(p.theme) === 'dark' ? 'light' : 'dark' }); }
  // Cycle à trois états pour le bouton d'en-tête : clair → sombre → auto → clair.
  function cycleTheme() {
    const order = ['light', 'dark', 'auto']; const p = get();
    const next = order[(order.indexOf(p.theme) + 1) % order.length];
    return set({ theme: next });
  }

  TRIPA.PREFS = { ACCENTS, get, set, apply, resolve, toggleTheme, cycleTheme };
  apply(get());
  // Si la préférence est 'auto', on suit les changements du système en direct.
  if (window.matchMedia) {
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (get().theme === 'auto') apply(); }); } catch (e) {}
  }
})();
