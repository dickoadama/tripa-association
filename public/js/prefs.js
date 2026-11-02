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
  function apply(p) {
    p = p || get();
    const root = document.documentElement;
    root.setAttribute('data-theme', p.theme);
    root.setAttribute('data-density', p.density);
    const accent = ACCENTS[p.accent] || p.accent || ACCENTS.indigo;
    root.style.setProperty('--accent', accent);
  }
  function set(patch) {
    const p = Object.assign(get(), patch || {});
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    apply(p);
    return p;
  }
  function toggleTheme() { const p = get(); return set({ theme: p.theme === 'dark' ? 'light' : 'dark' }); }

  TRIPA.PREFS = { ACCENTS, get, set, apply, toggleTheme };
  apply(get());
})();
