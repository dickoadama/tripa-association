/* TRIPA — UI + mise en page + registre des entités */
function esc(s){ return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatCurrency(n){ const v=Number(n)||0; return new Intl.NumberFormat('fr-FR').format(v)+' FCFA'; }
function formatDate(d){ if(!d) return '—'; try{ return new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return d; } }
function humanize(v){ if(v===true) return 'Oui'; if(v===false) return 'Non'; return String(v==null?'':v).replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase()); }
const STATUS_COLORS = {
  actif:'success',payee:'success',paye:'success',termine:'success',terminee:'success',
  inactif:'muted',en_attente:'warning',attente:'warning',en_cours:'info',planifie:'info',planifiee:'info',
  suspendu:'danger',en_retard:'danger',annule:'danger',annulee:'danger',haute:'danger',moyenne:'warning',basse:'muted',
  membre:'info',sympathisant:'muted',bureau:'info'
};
function badge(value){
  if(value===true||value==='true') return '<span class="badge badge--success">Épinglé</span>';
  if(value===false||value==null||value==='') return '<span class="muted">—</span>';
  const c=STATUS_COLORS[value]||'info'; return `<span class="badge badge--${c}">${esc(humanize(value))}</span>`;
}
function showToast(message,type='info',duration=3800){
  let box=document.querySelector('.toasts'); if(!box){ box=document.createElement('div'); box.className='toasts'; document.body.appendChild(box); }
  const t=document.createElement('div'); t.className='toast toast--'+type; t.textContent=message; box.appendChild(t);
  setTimeout(()=>t.remove(),duration);
}
function openModal(id){ const m=document.getElementById(id); if(m) m.classList.add('is-open'); }
function closeModal(id){ const m=document.getElementById(id); if(m) m.classList.remove('is-open'); }
document.addEventListener('click',e=>{ const o=e.target.closest('.modal'); if(o&&e.target===o) o.classList.remove('is-open'); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelectorAll('.modal.is-open').forEach(m=>m.classList.remove('is-open')); });

const ENTITY_SCHEMA = {
  adherents:{label:'Adhérents',singular:'Adhérent',icon:'users',fields:[
    {key:'nom',label:'Nom',type:'text',required:true,list:true},
    {key:'prenom',label:'Prénom',type:'text',required:true,list:true},
    {key:'email',label:'Email',type:'email',list:true},
    {key:'telephone',label:'Téléphone',type:'tel',list:true},
    {key:'categorie',label:'Catégorie',type:'select',options:['membre','sympathisant','bureau'],list:true},
    {key:'statut',label:'Statut',type:'select',options:['actif','inactif','suspendu'],list:true},
    {key:'date_adhesion',label:'Date d’adhésion',type:'date'},
    {key:'note',label:'Note',type:'textarea'}
  ]},
  cotisations:{label:'Cotisations',singular:'Cotisation',icon:'wallet',fields:[
    {key:'adherent_id',label:'Adhérent',type:'ref',ref:'adherents',required:true,list:true},
    {key:'montant',label:'Montant',type:'number',required:true,list:true},
    {key:'periode',label:'Période',type:'text',list:true},
    {key:'statut',label:'Statut',type:'select',options:['payee','en_attente','en_retard'],list:true},
    {key:'date_paiement',label:'Date de paiement',type:'date',list:true},
    {key:'mode_paiement',label:'Mode de paiement',type:'select',options:['especes','mobile_money','virement','cheque']}
  ]},
  evenements:{label:'Événements',singular:'Événement',icon:'calendar',fields:[
    {key:'titre',label:'Titre',type:'text',required:true,list:true},
    {key:'type',label:'Type',type:'select',options:['conference','fete','atelier','sortie','autre'],list:true},
    {key:'date',label:'Date',type:'date',required:true,list:true},
    {key:'heure',label:'Heure',type:'time'},
    {key:'lieu',label:'Lieu',type:'text',list:true},
    {key:'capacite',label:'Capacité',type:'number'},
    {key:'tarif',label:'Tarif',type:'number'},
    {key:'statut',label:'Statut',type:'select',options:['planifie','termine','annule'],list:true}
  ]},
  activites:{label:'Activités',singular:'Activité',icon:'activity',fields:[
    {key:'nom',label:'Nom',type:'text',required:true,list:true},
    {key:'responsable',label:'Responsable',type:'text',list:true},
    {key:'date',label:'Date',type:'date',list:true},
    {key:'lieu',label:'Lieu',type:'text'},
    {key:'description',label:'Description',type:'textarea'},
    {key:'statut',label:'Statut',type:'select',options:['planifiee','en_cours','terminee','annulee'],list:true}
  ]},
  communications:{label:'Annonces',singular:'Annonce',icon:'megaphone',fields:[
    {key:'titre',label:'Titre',type:'text',required:true,list:true},
    {key:'contenu',label:'Contenu',type:'textarea'},
    {key:'canal',label:'Canal',type:'select',options:['email','sms','affichage','reseaux'],list:true},
    {key:'date_publication',label:'Date de publication',type:'date',list:true},
    {key:'epingle',label:'Épinglée',type:'bool',list:true}
  ]},
  achats:{label:'Achats',singular:'Achat',icon:'shopping-cart',fields:[
    {key:'fournisseur',label:'Fournisseur',type:'text',required:true,list:true},
    {key:'categorie',label:'Catégorie',type:'select',options:['materiel','alimentation','transport','loyer','autre'],list:true},
    {key:'montant',label:'Montant',type:'number',required:true,list:true},
    {key:'date',label:'Date',type:'date',list:true},
    {key:'statut_paiement',label:'Paiement',type:'select',options:['paye','en_attente','en_retard'],list:true}
  ]},
  documents:{label:'Documents',singular:'Document',icon:'folder',fields:[
    {key:'nom',label:'Nom',type:'text',required:true,list:true},
    {key:'categorie',label:'Catégorie',type:'select',options:['statuts_reglements','bilans_financiers','pv_reunions','photos','autre'],list:true},
    {key:'taille',label:'Taille',type:'text',list:true},
    {key:'url',label:'Lien (URL)',type:'text'}
  ]},
  taches:{label:'Tâches',singular:'Tâche',icon:'check-square',fields:[
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
  {key:'taches',label:'Tâches',href:'entity.html?t=taches',icon:'check-square'},
  {key:'settings',label:'Réglages',href:'settings.html',icon:'settings'}
];

function buildLayout(activeKey,pageTitle){
  const profile=getSessionProfile()||{};
  const isSuper=profile.role==='super_admin';
  const initials=((profile.prenom?.[0]||'')+(profile.nom?.[0]||'')).toUpperCase()||'AD';
  const links=NAV.map(n=>`<a class="nav-link${n.key===activeKey?' is-active':''}" href="${n.href}"><i data-lucide="${n.icon}"></i><span>${n.label}</span></a>`).join('');
  const superLink=isSuper?`<a class="nav-link${activeKey==='admin'?' is-active':''}" href="admin-management.html"><i data-lucide="shield-check"></i><span>Console Super Admin</span></a>`:'';
  const sidebarHost=document.getElementById('sidebarHost');
  if(sidebarHost){ sidebarHost.className='sidebar';
    sidebarHost.innerHTML=`<div class="sidebar__logo">TRIPA</div><nav class="sidebar__nav">${links}${superLink}</nav>`; }
  const topbarHost=document.getElementById('topbarHost');
  if(topbarHost){ topbarHost.className='topbar';
    topbarHost.innerHTML=`<h2 class="page-title">${esc(pageTitle||'TRIPA')}</h2>
      <div class="row"><div class="row"><span class="badge">${esc(initials)}</span>
        <span class="muted" style="font-size:13px;">${esc([profile.prenom,profile.nom].filter(Boolean).join(' ')||'Admin')}</span></div>
        <button class="btn btn--ghost btn--sm" id="logoutBtn"><i data-lucide="log-out"></i></button></div>`;
    const lb=document.getElementById('logoutBtn'); if(lb) lb.addEventListener('click',()=>signOut());
  }
  if(window.lucide) lucide.createIcons();
}
