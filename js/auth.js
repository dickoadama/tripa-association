/* ==========================================
   TRIPA — Authentification (auth.js)
   Connexion / inscription via l'API TRIPA
   (backend Express + SQLite, dossier server/).
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // Login form handling
    // ==========================================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion...';

            try {
                await handleLogin(email, password);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Se connecter';
            }
        });

        // Toggle password visibility
        const toggleBtn = document.querySelector('.btn-toggle-password');
        const pwdInput = document.getElementById('password');

        if (toggleBtn && pwdInput) {
            toggleBtn.addEventListener('click', () => {
                const type = pwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
                pwdInput.setAttribute('type', type);

                // Update icon
                const icon = toggleBtn.querySelector('i');
                if (type === 'text') {
                    icon.setAttribute('data-lucide', 'eye-off');
                } else {
                    icon.setAttribute('data-lucide', 'eye');
                }

                // Re-render the specific icon
                lucide.createIcons({
                    nameAttr: 'data-lucide'
                });
            });
        }
    }

    // ==========================================
    // Register form handling
    // ==========================================
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const pwd = document.getElementById('password').value;
            const confirmPwd = document.getElementById('confirm-password').value;

            if (pwd !== confirmPwd) {
                alert('Les mots de passe ne correspondent pas.');
                return;
            }

            const email = document.getElementById('email').value.trim().toLowerCase();
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Création en cours...';

            try {
                await handleRegister(email, pwd);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Créer mon compte';
            }
        });
    }
});

// ==========================================
// Auth logic (API TRIPA)
// ==========================================

async function handleLogin(email, password) {
    const { data, error } = await loginUser(email, password);
    if (error) {
        alert('Erreur de connexion : ' + error.message);
        return;
    }

    const profile = data && data.profile;
    if (!profile) {
        alert('Aucun compte trouvé pour cette adresse. Contactez le Super Admin.');
        return;
    }

    // Super Admin : toujours accès direct à sa console
    if (profile.role === 'super_admin') {
        setSessionToken(data.token);
        saveSessionProfile(profile);
        window.location.href = 'admin-management.html';
        return;
    }

    // Validation gate for regular admins
    if (profile.status === 'pending') {
        alert('Votre compte est en attente de validation par le Super Admin.\nVous recevrez un accès une fois votre compte approuvé.');
        return;
    }
    if (profile.status === 'suspended') {
        alert('Votre compte a été suspendu par le Super Admin.');
        return;
    }
    if (profile.status === 'rejected') {
        alert('Votre inscription a été rejetée par le Super Admin.');
        return;
    }

    // Active admin
    setSessionToken(data.token);
    saveSessionProfile(profile);
    window.location.href = 'dashboard.html';
}

async function handleRegister(email, password) {
    const firstName = document.getElementById('firstname').value.trim();
    const lastName = document.getElementById('lastname').value.trim();
    const phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
    const assoType = document.getElementById('asso-type') ? document.getElementById('asso-type').value : '';

    if (isSuperAdminEmail(email)) {
        alert('Cette adresse email est réservée au Super Admin.');
        return;
    }

    const { error } = await registerUser({
        email, password,
        first_name: firstName,
        last_name: lastName,
        phone,
        asso_type: assoType
    });

    if (error) {
        alert('Erreur lors de l\'inscription : ' + error.message);
        return;
    }

    alert('Compte créé avec succès !\n\n⏳ Votre compte est en attente de validation par le Super Admin avant d\'avoir accès à l\'application.');
    window.location.href = 'index.html';
}
