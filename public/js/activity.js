/* TRIPA — Journal d'activité : historique des créations/modifications/suppressions. */
const ACT_META = {
  create: { icon: 'plus', color: 'success', label: 'Ajout' },
  update: { icon: 'pencil', color: 'info', label: 'Modification' },
  delete: { icon: 'trash-2', color: 'danger', label: 'Suppression' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const profile = await requireAuth(['active']); if (!profile) return;
  buildLayout('activity', 'Journal d’activité');
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="between wrap mb-6">
      <div class="row wrap" id="actFilters">
        <button class="btn btn--ghost btn--sm is-active" data-f="all">Tous</button>
        <button class="btn btn--ghost btn--sm" data-f="create"><i data-lucide="plus"></i> Ajouts</button>
        <button class="btn btn--ghost btn--sm" data-f="update"><i data-lucide="pencil"></i> Modifications</button>
        <button class="btn btn--ghost btn--sm" data-f="delete"><i data-lucide="trash-2"></i> Suppressions</button>
      </div>
      <button class="btn btn--ghost btn--sm" id="actRefresh"><i data-lucide="refresh-cw"></i> Actualiser</button>
    </div>
    <div class="card"><div class="card__body" id="actList"><div class="skeleton" style="height:44px;margin:8px 0;"></div><div class="skeleton" style="height:44px;margin:8px 0;"></div><div class="skeleton" style="height:44px;margin:8px 0;"></div></div></div>`;

  let ALL = [];
  let filter = 'all';

  async function load() {
    const box = document.getElementById('actList');
    const { data, error } = await fetchActivity(200);
    if (error) { box.innerHTML = `<div class="empty">${esc(error.message)}</div>`; return; }
    ALL = data || [];
    draw();
  }

  function fmt(d) {
    try { return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return d; }
  }

  function draw() {
    const box = document.getElementById('actList');
    const rows = filter === 'all' ? ALL : ALL.filter(a => a.action === filter);
    if (!rows.length) { box.innerHTML = '<div class="empty">Aucune activité enregistrée pour le moment.</div>'; return; }
    // Groupe par jour
    const groups = {};
    rows.forEach(a => { const day = String(a.created_at).slice(0, 10); (groups[day] = groups[day] || []).push(a); });
    box.innerHTML = Object.keys(groups).sort().reverse().map(day => {
      let titre = 'Aujourd’hui';
      const d = new Date(day); if (!isNaN(d)) { const today = new Date(); const yd = new Date(); yd.setDate(today.getDate() - 1);
        if (d.toDateString() !== today.toDateString() && d.toDateString() !== yd.toDateString()) titre = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }
      const items = groups[day].map(a => {
        const meta = ACT_META[a.action] || { icon: 'dot', color: 'muted', label: humanize(a.action) };
        const ent = ENTITY_SCHEMA[a.entity] ? ENTITY_SCHEMA[a.entity].label : humanize(a.entity || '');
        const link = ENTITY_SCHEMA[a.entity] ? `entity.html?t=${a.entity}` : '#';
        return `<div class="act-item row" style="gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
          <span class="badge badge--${meta.color}" style="width:32px;height:32px;justify-content:center;padding:0;"><i data-lucide="${meta.icon}" style="width:15px;height:15px;"></i></span>
          <div style="flex:1;min-width:0;">
            <div><strong>${esc(meta.label)}</strong> · <a href="${link}">${esc(ent)}</a>
              ${a.label ? `— <span class="muted">${esc(a.label)}</span>` : ''}</div>
            <div class="muted" style="font-size:12px;">${esc(fmt(a.created_at))}</div>
          </div></div>`;
      }).join('');
      return `<div class="g-label">${esc(titre)}</div>${items}`;
    }).join('');
    if (window.lucide) lucide.createIcons();
  }

  document.getElementById('actRefresh').addEventListener('click', () => load());
  document.getElementById('actFilters').querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.f;
    document.getElementById('actFilters').querySelectorAll('[data-f]').forEach(x => x.classList.toggle('is-active', x === b));
    draw();
  }));

  await load();
  attachReveal && attachReveal();
});
