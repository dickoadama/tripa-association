/* TRIPA — Couche de données 100 % locale (localStorage). Aucune requête HTTP. */
const SUPER_ADMIN_EMAIL = 'superadmin@tripa.com';
const DEFAULT_SUPER_ADMIN_PWD = 'tripa-super-2026';

// Clés des entités (alignées sur ENTITY_SCHEMA de utils.js)
const ENTITY_KEYS = ['adherents','cotisations','evenements','activites','communications','achats','documents','taches'];

function load(key){ try{ return JSON.parse(localStorage.getItem('tripa_'+key)); }catch(e){ return null; } }
function save(key,val){ try{ localStorage.setItem('tripa_'+key, JSON.stringify(val)); }catch(e){} }
function del(key){ try{ localStorage.removeItem('tripa_'+key); }catch(e){} }
function arr(key){ const v=load(key); return Array.isArray(v)?v:[]; }

function uuid(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}
function nowIso(){ return new Date().toISOString(); }
function hashPwd(str){
  let h1=0xdeadbeef^String(str).length, h2=0x41c6ce57^String(str).length; const s='tripa::'+String(str);
  for(let i=0;i<s.length;i++){const ch=s.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (h2>>>0)*4294967296+(h1>>>0);
}
function publicUser(u){ if(!u) return null; const {password_hash,...r}=u; return r; }

(function seed(){
  const users=arr('users');
  if(!users.some(u=>u.role==='super_admin')){
    users.push({id:uuid(),email:SUPER_ADMIN_EMAIL.toLowerCase(),password_hash:hashPwd(DEFAULT_SUPER_ADMIN_PWD),
      nom:'Super',prenom:'Admin',telephone:'',asso_type:'',role:'super_admin',status:'active',created_at:nowIso()});
    save('users',users);
  }
})();

function getSessionToken(){ return load('token'); }
function setSessionToken(t){ save('token',t); }
function clearSessionToken(){ del('token'); }
function saveSessionProfile(p){ save('session_profile',p); }
function getSessionProfile(){ return load('session_profile'); }
function clearSessionProfile(){ del('session_profile'); }
function isSuperAdminEmail(e){ return e && String(e).toLowerCase()===SUPER_ADMIN_EMAIL.toLowerCase(); }

function currentUser(){
  const token=getSessionToken(); if(!token) return null;
  const sessions=load('sessions')||{}; const uid=sessions[token]; if(!uid) return null;
  return arr('users').find(u=>u.id===uid)||null;
}

async function fetchAll(table,options={}){
  if(!ENTITY_KEYS.includes(table)) return {data:null,error:{message:'Entité inconnue.',status:404}};
  const user=currentUser(); if(!user) return {data:null,error:{message:'Session invalide.',status:401}};
  let rows=arr('data_'+table);
  if(user.role!=='super_admin') rows=rows.filter(r=>r.admin_id===user.id);
  if(options.filter) for(const [k,v] of Object.entries(options.filter)){
    if(v===undefined||v===null||v==='') continue; rows=rows.filter(r=>String(r[k])===String(v));
  }
  const col=(options.order&&options.order.column)||'created_at';
  const asc=options.order?!!options.order.ascending:false;
  rows.sort((a,b)=>{const x=a[col],y=b[col]; if(x===y) return 0; const d=x>y?1:-1; return asc?d:-d;});
  if(options.limit) rows=rows.slice(0,options.limit);
  return {data:rows,error:null};
}
async function fetchById(table,id){
  const {data,error}=await fetchAll(table); if(error) return {data:null,error};
  const row=(data||[]).find(r=>r.id===id)||null; return {data:row,error:row?null:{message:'Introuvable'}};
}
async function insertRow(table,row){
  if(!ENTITY_KEYS.includes(table)) return {data:null,error:{message:'Entité inconnue.',status:404}};
  const user=currentUser(); if(!user) return {data:null,error:{message:'Session invalide.',status:401}};
  const src=row||{}; const created={id:uuid(),created_at:nowIso()};
  created.admin_id = user.role==='super_admin' ? (src.admin_id||user.id) : user.id;
  const fields=window.ENTITY_SCHEMA&&ENTITY_SCHEMA[table]?ENTITY_SCHEMA[table].fields:[];
  for(const f of fields) if(src[f.key]!==undefined) created[f.key]=src[f.key];
  const rows=arr('data_'+table); rows.push(created); save('data_'+table,rows);
  return {data:created,error:null};
}
async function updateRow(table,id,updates){
  if(!ENTITY_KEYS.includes(table)) return {data:null,error:{message:'Entité inconnue.',status:404}};
  const user=currentUser(); if(!user) return {data:null,error:{message:'Session invalide.',status:401}};
  const rows=arr('data_'+table);
  const i=rows.findIndex(r=>r.id===id&&(user.role==='super_admin'||r.admin_id===user.id));
  if(i===-1) return {data:null,error:{message:'Ligne introuvable.',status:404}};
  const fields=window.ENTITY_SCHEMA&&ENTITY_SCHEMA[table]?ENTITY_SCHEMA[table].fields:[];
  for(const f of fields) if(updates&&updates[f.key]!==undefined) rows[i][f.key]=updates[f.key];
  save('data_'+table,rows); return {data:rows[i],error:null};
}
async function deleteRow(table,id){
  if(!ENTITY_KEYS.includes(table)) return {data:null,error:{message:'Entité inconnue.',status:404}};
  const user=currentUser(); if(!user) return {data:null,error:{message:'Session invalide.',status:401}};
  const rows=arr('data_'+table);
  const i=rows.findIndex(r=>r.id===id&&(user.role==='super_admin'||r.admin_id===user.id));
  if(i===-1) return {data:null,error:{message:'Ligne introuvable.',status:404}};
  rows.splice(i,1); save('data_'+table,rows); return {data:true,error:null};
}

async function registerUser(payload){
  const {email,password,nom,prenom,telephone,asso_type}=payload||{};
  if(!email||!password) return {data:null,error:{message:'Email et mot de passe requis.',status:400}};
  const mail=String(email).toLowerCase();
  if(isSuperAdminEmail(mail)) return {data:null,error:{message:'Adresse réservée.',status:403}};
  const users=arr('users');
  if(users.some(u=>u.email===mail)) return {data:null,error:{message:'Un compte existe déjà avec cet email.',status:409}};
  const user={id:uuid(),email:mail,password_hash:hashPwd(password),nom:nom||'',prenom:prenom||'',
    telephone:telephone||'',asso_type:asso_type||'',role:'admin',status:'pending',created_at:nowIso()};
  users.push(user); save('users',users); return {data:publicUser(user),error:null};
}
async function loginUser(email,password){
  const mail=String(email||'').toLowerCase();
  const user=arr('users').find(u=>u.email===mail);
  if(!user||user.password_hash!==hashPwd(password)) return {data:null,error:{message:'Email ou mot de passe incorrect.',status:401}};
  let token=null;
  if(user.status==='active'){ token=uuid(); const sessions=load('sessions')||{}; sessions[token]=user.id; save('sessions',sessions); }
  return {data:{token,profile:publicUser(user)},error:null};
}
async function fetchCurrentUser(){
  const u=currentUser();
  return u?{data:publicUser(u),error:null}:{data:null,error:{message:'Session invalide.',status:401}};
}
async function logoutUser(){
  const token=getSessionToken();
  if(token){ const s=load('sessions')||{}; delete s[token]; save('sessions',s); }
  clearSessionToken(); clearSessionProfile();
}
async function changePassword(currentPassword,newPassword){
  const u=currentUser(); if(!u) return {data:null,error:{message:'Session invalide.',status:401}};
  if(u.password_hash!==hashPwd(currentPassword)) return {data:null,error:{message:'Mot de passe actuel incorrect.',status:403}};
  if(!newPassword||String(newPassword).length<6) return {data:null,error:{message:'Le nouveau mot de passe doit faire au moins 6 caractères.',status:400}};
  const users=arr('users'); const i=users.findIndex(x=>x.id===u.id);
  users[i].password_hash=hashPwd(newPassword); save('users',users); return {data:true,error:null};
}
async function updateOwnProfile(updates){
  const u=currentUser(); if(!u) return {data:null,error:{message:'Session invalide.',status:401}};
  const users=arr('users'); const i=users.findIndex(x=>x.id===u.id);
  if(i===-1) return {data:null,error:{message:'Compte introuvable.',status:404}};
  for(const k of ['prenom','nom','telephone']) if(updates&&updates[k]!==undefined) users[i][k]=updates[k];
  save('users',users); const profile=publicUser(users[i]); saveSessionProfile(profile); return {data:profile,error:null};
}
async function signOut(){ await logoutUser(); window.location.href='index.html'; }

async function getAllAdmins(){
  const list=arr('users').filter(u=>u.role!=='super_admin').map(publicUser);
  list.sort((a,b)=>(a.created_at<b.created_at?1:-1)); return {data:list,error:null};
}
async function createAdminAccount(payload){
  const {email,password,nom,prenom,telephone,asso_type,status}=payload||{};
  if(!email||!password) return {data:null,error:{message:'Email et mot de passe requis.',status:400}};
  const mail=String(email).toLowerCase();
  if(isSuperAdminEmail(mail)) return {data:null,error:{message:'Adresse réservée au Super Admin.',status:403}};
  const users=arr('users');
  if(users.some(u=>u.email===mail)) return {data:null,error:{message:'Un compte existe déjà avec cet email.',status:409}};
  const user={id:uuid(),email:mail,password_hash:hashPwd(password),nom:nom||'',prenom:prenom||'',
    telephone:telephone||'',asso_type:asso_type||'',role:'admin',status:status||'active',created_at:nowIso()};
  users.push(user); save('users',users); return {data:publicUser(user),error:null};
}
async function updateAdminAccount(id,updates){
  const users=arr('users'); const i=users.findIndex(u=>u.id===id);
  if(i===-1) return {data:null,error:{message:'Compte introuvable.',status:404}};
  for(const c of ['nom','prenom','telephone','asso_type','status']) if(updates&&updates[c]!==undefined) users[i][c]=updates[c];
  if(updates&&updates.password) users[i].password_hash=hashPwd(updates.password);
  save('users',users); return {data:publicUser(users[i]),error:null};
}
async function deleteAdminAccount(id){
  const users=arr('users'); const u=users.find(x=>x.id===id);
  if(!u) return {data:null,error:{message:'Compte introuvable.',status:404}};
  if(u.role==='super_admin') return {data:null,error:{message:'Impossible de supprimer le Super Admin.',status:403}};
  for(const t of ENTITY_KEYS) save('data_'+t, arr('data_'+t).filter(r=>r.admin_id!==id));
  const s=load('sessions')||{}; for(const tk of Object.keys(s)) if(s[tk]===id) delete s[tk]; save('sessions',s);
  save('users',users.filter(x=>x.id!==id)); return {data:true,error:null};
}

async function requireAuth(allowed=['active']){
  if(!getSessionToken()){ clearSessionProfile(); window.location.href='index.html'; return null; }
  const {data:profile,error}=await fetchCurrentUser();
  if(error||!profile||!allowed.includes(profile.status)){ clearSessionToken(); clearSessionProfile(); window.location.href='index.html'; return null; }
  saveSessionProfile(profile); return profile;
}
async function requireSuperAdmin(){
  const p=await requireAuth(['active','pending','suspended']); if(!p) return null;
  if(p.role!=='super_admin'){ window.location.href='dashboard.html'; return null; } return p;
}
