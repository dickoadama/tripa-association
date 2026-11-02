/* TRIPA — Moteur CRUD générique (entity.html?t=<entité>) */
let ENTITY_TYPE='', ROWS=[], REF_MAPS={}, EDITING_ID=null;
function paramType(){ const t=new URLSearchParams(location.search).get('t'); return ENTITY_SCHEMA[t]?t:'adherents'; }

document.addEventListener('DOMContentLoaded', async () => {
  const profile=await requireAuth(['active']); if(!profile) return;
  ENTITY_TYPE=paramType();
  const schema=ENTITY_SCHEMA[ENTITY_TYPE];
  document.title='TRIPA — '+schema.label;
  await loadRefMaps();
  buildLayout(ENTITY_TYPE, schema.label);
  renderShell(schema);
  await loadData();
});

async function loadRefMaps(){
  REF_MAPS={};
  for(const f of ENTITY_SCHEMA[ENTITY_TYPE].fields){
    if(f.type==='ref' && !REF_MAPS[f.ref]){
      const {data}=await fetchAll(f.ref,{limit:2000});
      const map={};
      (data||[]).forEach(r=>{ map[r.id]=[r.prenom,r.nom].filter(Boolean).join(' ')||r.titre||r.nom||r.libelle||r.fournisseur||r.id.slice(0,6); });
      REF_MAPS[f.ref]=map;
    }
  }
}

function renderShell(schema){
  const content=document.getElementById('content');
  content.innerHTML=`
    <div class="between wrap mb-6">
      <input class="input" id="searchInput" placeholder="Rechercher..." style="max-width:320px;">
      <button class="btn btn--primary" id="addBtn"><i data-lucide="plus"></i> Nouveau ${esc(schema.singular)}</button>
    </div>
    <div class="card"><table class="table" id="dataTable"></table></div>`;
  document.getElementById('addBtn').addEventListener('click',()=>openForm());
  document.getElementById('searchInput').addEventListener('input',renderTable);
  if(window.lucide) lucide.createIcons();
}

async function loadData(){
  const {data,error}=await fetchAll(ENTITY_TYPE,{order:{column:'created_at',ascending:false}});
  if(error){ showToast('Erreur : '+error.message,'danger'); ROWS=[]; } else ROWS=data||[];
  renderTable();
}

function cellValue(field,row){
  let v=row[field.key];
  if(field.type==='ref') return `<span>${esc((REF_MAPS[field.ref]||{})[v]||'—')}</span>`;
  if(field.type==='select'||field.type==='bool') return badge(field.type==='bool'?!!v:v);
  if(field.key==='montant'||field.key==='tarif') return `<span>${formatCurrency(v)}</span>`;
  if(field.type==='date') return `<span>${formatDate(v)}</span>`;
  return `<span>${v==null||v===''?'—':esc(v)}</span>`;
}

function renderTable(){
  const schema=ENTITY_SCHEMA[ENTITY_TYPE];
  const cols=schema.fields.filter(f=>f.list);
  const q=(document.getElementById('searchInput').value||'').toLowerCase().trim();
  let list=ROWS;
  if(q) list=ROWS.filter(r=>cols.some(c=>String(r[c.key]??'').toLowerCase().includes(q)));
  const table=document.getElementById('dataTable');
  const head=`<thead><tr>${cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}<th style="text-align:right;">Actions</th></tr></thead>`;
  if(!list.length){ table.innerHTML=`${head}<tbody><tr><td colspan="${cols.length+1}"><div class="empty">Aucun élément</div></td></tr></tbody>`; if(window.lucide) lucide.createIcons(); return; }
  const body=list.map(r=>`<tr>${cols.map(c=>`<td>${cellValue(c,r)}</td>`).join('')}
    <td style="text-align:right;white-space:nowrap;">
      <button class="btn btn--ghost btn--sm" onclick="openForm('${r.id}')"><i data-lucide="pencil"></i></button>
      <button class="btn btn--ghost btn--sm" style="color:var(--danger)" onclick="removeRow('${r.id}')"><i data-lucide="trash-2"></i></button>
    </td></tr>`).join('');
  table.innerHTML=`${head}<tbody>${body}</tbody>`;
  if(window.lucide) lucide.createIcons();
}

function fieldInput(f,value){
  const v=value==null?'':value;
  if(f.type==='select'){ const opts=(f.options||[]).map(o=>`<option value="${o}" ${o===v?'selected':''}>${esc(humanize(o))}</option>`).join('');
    return `<select class="select" name="${f.key}"><option value="">—</option>${opts}</select>`; }
  if(f.type==='bool') return `<input type="checkbox" name="${f.key}" ${v?'checked':''} style="width:auto;">`;
  if(f.type==='ref'){ const map=REF_MAPS[f.ref]||{}; const opts=Object.entries(map).map(([id,lbl])=>`<option value="${id}" ${id===v?'selected':''}>${esc(lbl)}</option>`).join('');
    return `<select class="select" name="${f.key}"><option value="">—</option>${opts}</select>`; }
  if(f.type==='textarea') return `<textarea class="textarea" name="${f.key}">${esc(v)}</textarea>`;
  const inputType=f.type==='number'?'number':f.type;
  return `<input class="input" type="${inputType}" name="${f.key}" value="${esc(v)}">`;
}

function openForm(id){
  EDITING_ID=id||null;
  const schema=ENTITY_SCHEMA[ENTITY_TYPE];
  const row=id?ROWS.find(r=>r.id===id):{};
  document.getElementById('formTitle').textContent=(id?'Modifier ':'Nouveau ')+schema.singular;
  document.getElementById('entityForm').innerHTML=
    schema.fields.map(f=>`<div class="field"><label class="label">${esc(f.label)}${f.required?' *':''}</label>${fieldInput(f,row[f.key])}</div>`).join('')+
    `<div class="row mt-4"><button type="submit" class="btn btn--primary">Enregistrer</button>
      <button type="button" class="btn btn--ghost" onclick="closeModal('formModal')">Annuler</button></div>`;
  document.getElementById('entityForm').onsubmit=submitForm;
  openModal('formModal');
  if(window.lucide) lucide.createIcons();
}

async function submitForm(e){
  e.preventDefault();
  const schema=ENTITY_SCHEMA[ENTITY_TYPE];
  const formEl=document.getElementById('entityForm');
  const payload={};
  for(const f of schema.fields){
    const el=formEl.elements[f.key]; if(!el) continue;
    let val;
    if(f.type==='bool') val=el.checked;
    else if(f.type==='number') val=el.value===''?null:Number(el.value);
    else val=el.value;
    if(f.required && (val===''||val===null||val===undefined)){ showToast(f.label+' est obligatoire.','warning'); return; }
    payload[f.key]=val;
  }
  const res=EDITING_ID?await updateRow(ENTITY_TYPE,EDITING_ID,payload):await insertRow(ENTITY_TYPE,payload);
  if(res.error){ showToast('Erreur : '+res.error.message,'danger'); return; }
  closeModal('formModal'); showToast(ENTITY_SCHEMA[ENTITY_TYPE].singular+' enregistré.','success');
  await loadRefMaps(); await loadData();
}

async function removeRow(id){
  if(!confirm('Supprimer cet élément ?')) return;
  const {error}=await deleteRow(ENTITY_TYPE,id);
  if(error){ showToast('Erreur : '+error.message,'danger'); return; }
  ROWS=ROWS.filter(r=>r.id!==id); renderTable(); showToast('Élément supprimé.','success');
}
