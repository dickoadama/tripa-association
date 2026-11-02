/* TRIPA — Auth (login / register) */
document.addEventListener('DOMContentLoaded', () => {
  const loginForm=document.getElementById('login-form');
  if(loginForm) loginForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const email=document.getElementById('email').value.trim().toLowerCase();
    const password=document.getElementById('password').value;
    await handleLogin(email,password);
  });
  const registerForm=document.getElementById('register-form');
  if(registerForm) registerForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const pwd=document.getElementById('password').value;
    const confirmPwd=document.getElementById('confirm-password').value;
    if(pwd!==confirmPwd){ alert('Les mots de passe ne correspondent pas.'); return; }
    const email=document.getElementById('email').value.trim().toLowerCase();
    if(isSuperAdminEmail(email)){ alert('Cette adresse est réservée au Super Admin.'); return; }
    await handleRegister({ email, password:pwd,
      nom:(document.getElementById('lastname')?.value||'').trim(),
      prenom:(document.getElementById('firstname')?.value||'').trim(),
      telephone:(document.getElementById('phone')?.value||'').trim(),
      asso_type:document.getElementById('asso-type')?.value||'' });
  });
});
async function handleLogin(email,password){
  const {data,error}=await loginUser(email,password);
  if(error){ alert('Connexion impossible : '+error.message); return; }
  const profile=data&&data.profile;
  if(!profile){ alert('Aucun compte trouvé.'); return; }
  if(profile.role==='super_admin'){ setSessionToken(data.token); saveSessionProfile(profile); window.location.href='admin-management.html'; return; }
  if(profile.status==='pending'){ alert('Compte en attente de validation par le Super Admin.'); return; }
  if(profile.status==='suspended'){ alert('Votre compte a été suspendu.'); return; }
  if(profile.status==='rejected'){ alert('Votre inscription a été rejetée.'); return; }
  setSessionToken(data.token); saveSessionProfile(profile); window.location.href='dashboard.html';
}
async function handleRegister(payload){
  const {error}=await registerUser(payload);
  if(error){ alert('Inscription impossible : '+error.message); return; }
  alert('Compte créé ! Il est en attente de validation par le Super Admin.');
  window.location.href='index.html';
}
