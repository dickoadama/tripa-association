/* TRIPA — UI kit, navigation, registre des entités, mise en page (en-tête + pied). */
function esc(s){ return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatCurrency(n){ const v=Number(n)||0; return new Intl.NumberFormat('fr-FR').format(v)+' FCFA'; }
function formatDate(d){ if(!d) return '—'; try{ return new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return d; } }
function humanize(v){ if(v===true) return 'Oui'; if(v===false) return 'Non'; return String(v==null?'':v).replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase()); }
const STATUS_COLORS = {
  actif:'success',payee:'success',paye:'success',termine:'success',terminee:'success',
  inactif:'muted',en_attente:'warning',attente:'warning',en_cours:'info',planifie:'info',planifiee:'info',
  suspendu:'danger',en_retard:'danger',annule:'danger',annulee:'danger',haute:'danger',moyenne:'warning',basse:'muted',
  membre:'info',sympathisant:'muted',bureau:'info',a_faire:'muted'
};
function badge(value){
  if(value===true||value==='true') return '<span class="badge badge--success">Épinglé</span>';
  if(value===false||value==null||value==='') return '<span class="muted">—</span>';
  const c=STATUS_COLORS[value]||'info'; return `<span class="badge badge--${c}">${esc(humanize(value))}</span>`;
}
function showToast(message,type='info',duration=3800){
  let box=document.querySelector('.toasts'); if(!box){ box=document.createElement('div'); box.className='toasts'; document.body.appendChild(box); }
  const t=document.createElement('div'); t.className='toast toast--'+type; t.textContent=message; box.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(10px)'; setTimeout(()=>t.remove(),260); },duration);
}
function openModal(id){ const m=document.getElementById(id); if(m) m.classList.add('is-open'); }
function closeModal(id){ const m=document.getElementById(id); if(m) m.classList.remove('is-open'); }
document.addEventListener('click',e=>{ const o=e.target.closest('.modal'); if(o&&e.target===o) o.classList.remove('is-open'); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ document.querySelectorAll('.modal.is-open').forEach(m=>m.classList.remove('is-open')); document.querySelectorAll('.dropdown.is-open').forEach(d=>d.classList.remove('is-open')); } });

const ENTITY_SCHEMA = {
  adherents:{label:'Adhérents',singular:'Adhérent',icon:'users',titleField:['prenom','nom'],fields:[
    {key:'nom',label:'Nom',type:'text',required:true,list:true},
    {key:'prenom',label:'Prénom',type:'text',required:true,list:true},
    {key:'email',label:'Email',type:'email',list:true},
    {key:'telephone',label:'Téléphone',type:'tel',list:true},
    {key:'categorie',label:'Catégorie',type:'select',options:['membre','sympathisant','bureau'],list:true},
    {key:'statut',label:'Statut',type:'select',options:['actif','inactif','suspendu'],list:true},
    {key:'date_adhesion',label:'Date d’adhésion',type:'date'},
    {key:'note',label:'Note',type:'textarea'}
  ]},
  cotisations:{label:'Cotisations',singular:'Cotisation',icon:'wallet',titleField:['periode'],fields:[
    {key:'adherent_id',label:'Adhérent',type:'ref',ref:'adherents',required:true,list:true},
    {key:'montant',label:'Montant',type:'number',required:true,list:true},
    {key:'periode',label:'Période',type:'text',list:true},
    {key:'statut',label:'Statut',type:'select',options:['payee','en_attente','en_retard'],list:true},
    {key:'date_paiement',label:'Date de paiement',type:'date',list:true},
    {key:'mode_paiement',label:'Mode de paiement',type:'select',options:['especes','mobile_money','virement','cheque']}
  ]},
  evenements:{label:'Événements',singular:'Événement',icon:'calendar',titleField:['titre'],fields:[
    {key:'titre',label:'Titre',type:'text',required:true,list:true},
    {key:'type',label:'Type',type:'select',options:['conference','fete','atelier','sortie','autre'],list:true},
    {key:'date',label:'Date',type:'date',required:true,list:true},
    {key:'heure',label:'Heure',type:'time'},
    {key:'lieu',label:'Lieu',type:'text',list:true},
    {key:'capacite',label:'Capacité',type:'number'},
    {key:'tarif',label:'Tarif',type:'number'},
    {key:'statut',label:'Statut',type:'select',options:['planifie','termine','annule'],list:true}
  ]},
  activites:{label:'Activités',singular:'Activité',icon:'activity',titleField:['nom'],fields:[
    {key:'nom',label:'Nom',type:'text',required:true,list:true},
    {key:'responsable',label:'Responsable',type:'text',list:true},
    {key:'date',label:'Date',type:'date',list:true},
    {key:'lieu',label:'Lieu',type:'text'},
    {key:'description',label:'Description',type:'textarea'},
    {key:'statut',label:'Statut',type:'select',options:['planifiee','en_cours','terminee','annulee'],list:true}
  ]},
  communications:{label:'Annonces',singular:'Annonce',icon:'megaphone',titleField:['titre'],fields:[
    {key:'titre',label:'Titre',type:'text',required:true,list:true},
    {key:'contenu',label:'Contenu',type:'textarea'},
    {key:'canal',label:'Canal',type:'select',options:['email','sms','affichage','reseaux'],list:true},
    {key:'date_publication',label:'Date de publication',type:'date',list:true},
    {key:'epingle',label:'Épinglée',type:'bool',list:true}
  ]},
  achats:{label:'Achats',singular:'Achat',icon:'shopping-cart',titleField:['fournisseur'],fields:[
    {key:'fournisseur',label:'Fournisseur',type:'text',required:true,list:true},
    {key:'categorie',label:'Catégorie',type:'select',options:['materiel','alimentation','transport','loyer','autre'],list:true},
    {key:'montant',label:'Montant',type:'number',required:true,list:true},
    {key:'date',label:'Date',type:'date',list:true},
    {key:'statut_paiement',label:'Paiement',type:'select',options:['paye','en_attente','en_retard'],list:true}
  ]},
  documents:{label:'Documents',singular:'Document',icon:'folder',titleField:['nom'],fields:[
    {key:'nom',label:'Nom',type:'text',required:true,list:true},
    {key:'categorie',label:'Catégorie',type:'select',options:['statuts_reglements','bilans_financiers','pv_reunions','photos','autre'],list:true},
    {key:'taille',label:'Taille',type:'text',list:true},
    {key:'url',label:'Lien (URL)',type:'text'}
  ]},
  taches:{label:'Tâches',singular:'Tâche',icon:'check-square',titleField:['libelle'],fields:[
    {key:'libelle',label:'Libellé',type:'text',required:true,list:true},
    {key:'assigne',label:'Assignée à',type:'text',list:true},
    {key:'priorite',label:'Priorité',type:'select',options:['basse','moyenne','haute'],list:true},
    {key:'echeance',label:'Échéance',type:'date',list:true},
    {key:'statut',label:'Statut',type:'select',options:['a_faire','en_cours','termine','attente'],list:true}
  ]}
};
window.ENTITY_SCHEMA = ENTITY_SCHEMA;

const NAV = [
  {key:'dashboard',label:'Tableau de bord',href:'dashboard.html',icon:'layout-dashboard'},
  {key:'adherents',label:'Adhérents',href:'entity.html?t=adherents',icon:'users'},
  {key:'cotisations',label:'Cotisations',href:'entity.html?t=cotisations',icon:'wallet'},
  {key:'evenements',label:'Événements',href:'entity.html?t=evenements',icon:'calendar'},
  {key:'activites',label:'Activités',href:'entity.html?t=activites',icon:'activity'},
  {key:'communications',label:'Annonces',href:'entity.html?t=communications',icon:'megaphone'},
  {key:'achats',label:'Achats',href:'entity.html?t=achats',icon:'shopping-cart'},
  {key:'documents',label:'Documents',href:'entity.html?t=documents',icon:'folder'},
  {key:'taches',label:'Tâches',href:'entity.html?t=taches',icon:'check-square'}
];
const NAV_FOOT = [
  {key:'profile',label:'Mon profil',href:'profile.html',icon:'user-circle'},
  {key:'activity',label:'Journal d’activité',href:'activity.html',icon:'history'},
  {key:'settings',label:'Réglages',href:'settings.html',icon:'settings'},
  {key:'help',label:'Aide & À propos',href:'help.html',icon:'help-circle'}
];

function rowTitle(entity,row){
  const tf=ENTITY_SCHEMA[entity]&&ENTITY_SCHEMA[entity].titleField||[];
  const t=tf.map(k=>row[k]).filter(Boolean).join(' ');
  return t||row.titre||row.nom||row.libelle||row.fournisseur||row.periode||('Élément '+String(row.id||'').slice(0,6));
}

/* ---------- Effets : ondulation + révélation ---------- */
function attachRipple(scope){
  (scope||document).querySelectorAll('.btn').forEach(b=>{
    if(b.dataset.ripple) return; b.dataset.ripple='1';
    b.addEventListener('pointerdown',e=>{
      const r=b.getBoundingClientRect(), s=document.createElement('span');
      const size=Math.max(r.width,r.height); s.className='ripple';
      s.style.width=s.style.height=size+'px'; s.style.left=(e.clientX-r.left-size/2)+'px'; s.style.top=(e.clientY-r.top-size/2)+'px';
      b.appendChild(s); setTimeout(()=>s.remove(),600);
    });
  });
}
function attachReveal(){
  const els=[...document.querySelectorAll('.content .card, .content .stat')];
  els.forEach(el=>{ el.classList.add('card--hover','reveal'); });
  if(!('IntersectionObserver' in window)){ els.forEach(el=>el.classList.add('in')); return; }
  const io=new IntersectionObserver(entries=>{ entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } }); },{threshold:.06});
  els.forEach(el=>io.observe(el));
}

/* ---------- Menus déroulants ---------- */
function wireDropdowns(){
  document.querySelectorAll('[data-dd]').forEach(btn=>{
    if(btn.dataset.dd1) return; btn.dataset.dd1='1';
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const menu=document.getElementById(btn.getAttribute('data-dd')); if(!menu) return;
      const open=menu.classList.contains('is-open');
      document.querySelectorAll('.dropdown.is-open').forEach(d=>d.classList.remove('is-open'));
      if(!open) menu.classList.add('is-open');
    });
  });
  document.addEventListener('click',()=>document.querySelectorAll('.dropdown.is-open').forEach(d=>d.classList.remove('is-open')));
}

/* ---------- Recherche globale ---------- */
function ensureSearchModal(){
  if(document.getElementById('searchModal')) return;
  const div=document.createElement('div'); div.className='modal'; div.id='searchModal';
  div.innerHTML='<div class="modal__box"><div class="card__header"><h3>Recherche globale</h3><button class="btn btn--icon btn--ghost" onclick="closeModal(\'searchModal\')"><i data-lucide="x"></i></button></div><div class="card__body results" id="searchResults"></div></div>';
  document.body.appendChild(div);
}
async function runGlobalSearch(q){
  q=(q||'').trim(); if(q.length<2){ showToast('Saisissez au moins 2 caractères.','warning'); return; }
  ensureSearchModal(); openModal('searchModal');
  const box=document.getElementById('searchResults'); box.innerHTML='<div class="skeleton" style="margin:8px 0;"></div><div class="skeleton" style="margin:8px 0;"></div><div class="skeleton" style="margin:8px 0;"></div>';
  let html='', total=0;
  for(const key of Object.keys(ENTITY_SCHEMA)){
    const {data}=await fetchAll(key,{search:q,limit:6});
    const rows=data||[]; if(!rows.length) continue; total+=rows.length;
    html+=`<div class="g-label mt-4">${esc(ENTITY_SCHEMA[key].label)}</div>`;
    html+=rows.map(r=>`<a href="entity.html?t=${key}&q=${encodeURIComponent(q)}"><span>${esc(rowTitle(key,r))}</span><span class="muted">${esc(humanize(r.statut||r.priorite||r.categorie||''))}</span></a>`).join('');
  }
  box.innerHTML= total? html : '<div class="empty">Aucun résultat pour « '+esc(q)+' »</div>';
  if(window.lucide) lucide.createIcons();
}

/* ---------- Notifications (fil récent, meilleur effort) ---------- */
async function loadNotifications(){
  const box=document.getElementById('notifList'); if(!box||box.dataset.loaded) return; box.dataset.loaded='1';
  const src=[['taches','a_faire'],['evenements',''],['communications','']];
  let items=[];
  for(const [key] of src){ const {data}=await fetchAll(key,{limit:5,order:{column:'created_at',ascending:false}}); (data||[]).forEach(r=>items.push({key,title:rowTitle(key,r),date:r.created_at})); }
  items.sort((a,b)=>(a.date<b.date?1:-1)); items=items.slice(0,8);
  box.innerHTML= items.length? items.map(i=>`<a href="entity.html?t=${i.key}"><span>${esc(ENTITY_SCHEMA[i.key].singular)}</span><span class="muted">${esc(i.title).slice(0,28)}</span></a>`).join('') : '<div style="padding:12px;" class="muted">Aucune activité récente.</div>';
}

/* ---------- Mise en page ---------- */
function buildLayout(activeKey,pageTitle){
  const profile=getSessionProfile()||{};
  const isSuper=profile.role==='super_admin';
  const prefs=window.TRIPA&&TRIPA.PREFS?TRIPA.PREFS.get():{theme:'light',notifications:true};
  const initials=((profile.prenom?.[0]||'')+(profile.nom?.[0]||'')).toUpperCase()||'AD';
  const fullName=[profile.prenom,profile.nom].filter(Boolean).join(' ')||'Admin';
  const nameHtml=esc(fullName), emailHtml=esc(profile.email||'');

  const linksMain=NAV.map(n=>navLink(n,activeKey)).join('');
  const linksFoot=NAV_FOOT.map(n=>navLink(n,activeKey)).join('');
  const superLink=isSuper?`<a class="nav-link${activeKey==='admin'?' is-active':''}" href="admin-management.html"><i data-lucide="shield-check"></i><span>Console Super Admin</span></a>`:'';

  const sidebarHost=document.getElementById('sidebarHost');
  if(sidebarHost){ sidebarHost.className='sidebar';
    sidebarHost.innerHTML=`<div class="sidebar__logo">TRIPA</div>
      <div class="sidebar__section">Gestion</div><nav class="sidebar__nav">${linksMain}</nav>
      <div class="sidebar__section">Compte</div><nav class="sidebar__nav">${superLink}${linksFoot}</nav>
      <div class="side-user"><div class="avatar">${esc(initials)}</div>
        <div style="min-width:0;flex:1;"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nameHtml}</div>
        <div class="muted" style="font-size:12px;">${emailHtml}</div></div>
        <button class="iconbtn" title="Déconnexion" onclick="signOut()"><i data-lucide="log-out"></i></button></div>`; }

  const topbarHost=document.getElementById('topbarHost');
  if(topbarHost){ topbarHost.className='topbar';
    topbarHost.innerHTML=`<h1 class="topbar__title">${esc(pageTitle||'TRIPA')}</h1>
      <div class="topbar__actions">
        <div class="search"><i data-lucide="search"></i>
          <input class="input" id="globalSearch" placeholder="Rechercher…" autocomplete="off"><kbd>Ctrl K</kbd></div>
        ${prefs.notifications?`<div class="relative"><button class="iconbtn" id="notifBtn" data-dd="notifMenu" title="Notifications"><i data-lucide="bell"></i><span class="dot"></span></button>
          <div class="dropdown" id="notifMenu"><div style="padding:8px 12px;font-weight:600;">Notifications</div><hr><div id="notifList"></div></div></div>`:''}
        <button class="iconbtn" id="themeBtn" title="Thème"><i data-lucide="${themeIcon(prefs.theme)}"></i></button>
        <div class="relative"><button class="iconbtn" data-dd="userMenu" title="Compte"><div class="avatar" style="width:28px;height:28px;font-size:12px;">${esc(initials)}</div></button>
          <div class="dropdown" id="userMenu"><div style="padding:8px 12px;"><div class="u-name">${nameHtml}</div><div class="muted" style="font-size:12px;">${emailHtml}</div></div><hr>
            <a href="profile.html"><i data-lucide="user-circle"></i> Mon profil</a>
            <a href="settings.html"><i data-lucide="settings"></i> Réglages</a>
            <hr><button onclick="signOut()"><i data-lucide="log-out"></i> Déconnexion</button></div></div>
      </div>`; }

  // Pied de page (injecté après <main> dans la colonne de droite)
  const contentEl=document.getElementById('content');
  if(contentEl && contentEl.parentElement && !document.getElementById('appFooter')){
    const f=document.createElement('footer'); f.id='appFooter'; f.className='footer';
    f.innerHTML=`<div><span class="footer__brand">TRIPA</span> · Gestion d'association</div>
      <div class="row wrap" style="gap:16px;"><span><span class="status-dot" id="netDot"></span><span id="netTxt">En ligne</span></span>
        <a href="help.html">Aide</a><a href="settings.html">Réglages</a><span>v3.0</span></div>`;
    contentEl.parentElement.appendChild(f);
  }

  // Interactions
  if(topbarHost){
    const gs=document.getElementById('globalSearch');
    if(gs) gs.addEventListener('keydown',e=>{ if(e.key==='Enter') runGlobalSearch(gs.value); });
    document.addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); const s=document.getElementById('globalSearch'); if(s) s.focus(); } });
    const tb=document.getElementById('themeBtn');
    if(tb) tb.addEventListener('click',()=>{ const p=TRIPA.PREFS.cycleTheme(); tb.innerHTML='<i data-lucide="'+themeIcon(p.theme)+'"></i>'; lucide.createIcons(); showToast('Thème : '+({light:'clair',dark:'sombre',auto:'auto (système)'})[p.theme]+'.','info',1600); });
    const nb=document.getElementById('notifBtn');
    if(nb) nb.addEventListener('click',()=>loadNotifications());
  }

  if(window.lucide) lucide.createIcons();
  wireDropdowns(); attachRipple(); attachReveal();
}
function navLink(n,activeKey){ return `<a class="nav-link${n.key===activeKey?' is-active':''}" href="${n.href}"><i data-lucide="${n.icon}"></i><span>${n.label}</span></a>`; }
function themeIcon(t){ return t==='dark'?'sun':t==='auto'?'monitor':'moon'; }

/* Indicateur réseau (pied de page) */
window.addEventListener('online',()=>{ const d=document.getElementById('netDot'); if(d){d.classList.remove('off');document.getElementById('netTxt').textContent='En ligne';} });
window.addEventListener('offline',()=>{ const d=document.getElementById('netDot'); if(d){d.classList.add('off');document.getElementById('netTxt').textContent='Hors ligne';} });
if(!navigator.onLine){ document.addEventListener('DOMContentLoaded',()=>{ const d=document.getElementById('netDot'); if(d){d.classList.add('off');const t=document.getElementById('netTxt'); if(t)t.textContent='Hors ligne';} }); }
