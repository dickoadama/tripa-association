/* TRIPA — Enregistrement du Service Worker (PWA hors-ligne). */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
