/* ==========================================
   TRIPA — Utilities (utils.js)
   ========================================== */

// ==========================================
// Sidebar & Navigation
// ==========================================

/**
 * Initialize sidebar toggle for mobile
 */
function initSidebar() {
  const hamburger = document.getElementById('hamburgerBtn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
      document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    });
  }
  
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  }
  
  // Close sidebar on window resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
}

// ==========================================
// Modals
// ==========================================

/**
 * Open a modal by ID
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close a modal by ID
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Initialize all modal close behaviors
 */
function initModals() {
  // Close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
  
  // Close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      closeModal(modalId);
    });
  });
  
  // Open buttons
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-open-modal');
      openModal(modalId);
    });
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
      });
      document.body.style.overflow = '';
    }
  });
}

// ==========================================
// Dropdowns
// ==========================================

function initDropdowns() {
  document.querySelectorAll('.dropdown').forEach(dropdown => {
    const trigger = dropdown.querySelector('[data-dropdown-trigger]');
    const menu = dropdown.querySelector('.dropdown__menu');
    
    if (trigger && menu) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other dropdowns
        document.querySelectorAll('.dropdown__menu.active').forEach(m => {
          if (m !== menu) m.classList.remove('active');
        });
        menu.classList.toggle('active');
      });
    }
  });
  
  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown__menu.active').forEach(m => {
      m.classList.remove('active');
    });
  });
}

// ==========================================
// Toast Notifications
// ==========================================

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'success' | 'danger' | 'warning' | 'info'
 * @param {number} duration - Duration in ms (default: 4000)
 */
function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const icons = {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    danger: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    ${icons[type] || icons.info}
    <span style="flex: 1; color: var(--color-text-primary);">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;padding:4px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==========================================
// Formatting Helpers
// ==========================================

/**
 * Format a number as currency (FCFA)
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

/**
 * Format a date in French
 */
function formatDate(dateStr) {
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return new Date(dateStr).toLocaleDateString('fr-FR', options);
}

/**
 * Format a date with time
 */
function formatDateTime(dateStr) {
  const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateStr).toLocaleDateString('fr-FR', options);
}

/**
 * Get relative time (e.g., "il y a 2 heures")
 */
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  
  const intervals = [
    { label: 'an', seconds: 31536000 },
    { label: 'mois', seconds: 2592000 },
    { label: 'semaine', seconds: 604800 },
    { label: 'jour', seconds: 86400 },
    { label: 'heure', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      const plural = count > 1 && interval.label !== 'mois' ? 's' : '';
      return `il y a ${count} ${interval.label}${plural}`;
    }
  }
  
  return 'à l\'instant';
}

/**
 * Get today's date formatted in French
 */
function getTodayFormatted() {
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const today = new Date().toLocaleDateString('fr-FR', options);
  // Capitalize first letter
  return today.charAt(0).toUpperCase() + today.slice(1);
}

/**
 * Get initials from a name
 */
function getInitials(firstName, lastName) {
  return (firstName?.charAt(0) || '') + (lastName?.charAt(0) || '');
}

// ==========================================
// Search & Filter
// ==========================================

/**
 * Filter a list of elements by text content
 */
function filterElements(selector, searchText) {
  const elements = document.querySelectorAll(selector);
  const search = searchText.toLowerCase().trim();
  
  elements.forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(search) ? '' : 'none';
  });
}

// ==========================================
// Role Helpers
// ==========================================

const ROLES = {
  admin: { label: 'Administrateur', color: 'primary', icon: 'shield' },
  president: { label: 'Président', color: 'primary', icon: 'crown' },
  vice_president: { label: 'Vice-Président', color: 'primary', icon: 'star' },
  secretaire_general: { label: 'Secrétaire Général', color: 'info', icon: 'pen-tool' },
  secretaire: { label: 'Secrétaire', color: 'info', icon: 'file-text' },
  secretaire_adjoint: { label: 'Secrétaire Adjoint', color: 'info', icon: 'file-signature' },
  tresorier: { label: 'Trésorier', color: 'success', icon: 'wallet' },
  tresorier_adjoint: { label: 'Trésorier Adjoint', color: 'success', icon: 'piggy-bank' },
  tresorerie: { label: 'Trésorerie', color: 'success', icon: 'coins' },
  organisateur: { label: 'Organisateur d\'Événements', color: 'secondary', icon: 'calendar-heart' },
  animateur: { label: 'Animateur', color: 'warning', icon: 'sparkles' },
  charge_communication: { label: 'Chargé de Communication', color: 'info', icon: 'megaphone' },
  charge_logistique: { label: 'Chargé de Logistique', color: 'ghost', icon: 'truck' },
  responsable_jeunesse: { label: 'Responsable Jeunesse', color: 'warning', icon: 'smile' },
  conseiller: { label: 'Conseiller', color: 'secondary', icon: 'lightbulb' },
  ca: { label: 'Conseil d\'Admin', color: 'secondary', icon: 'users' },
  commissaire_comptes: { label: 'Commissaire aux Comptes', color: 'secondary', icon: 'calculator' },
  moderateur: { label: 'Modérateur', color: 'warning', icon: 'message-square' },
  guide_spirituel: { label: 'Guide Spirituel', color: 'warning', icon: 'book-open' },
  benevole: { label: 'Bénévole', color: 'ghost', icon: 'heart' },
  membre: { label: 'Membre Actif', color: 'ghost', icon: 'user' }
};

// ---- Rôles personnalisés créés par les administrateurs ----
// Stockés en localStorage ('tripa_customRoles'), fusionnés avec ROLES.

function getCustomRoles() {
  const r = loadFromLocal('customRoles');
  return (r && typeof r === 'object') ? r : {};
}

function getRoles() {
  return Object.assign({}, ROLES, getCustomRoles());
}

function slugifyRoleLabel(label) {
  return String(label).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'role';
}

/**
 * Créer un rôle personnalisé.
 * @returns {{key?: string, error?: string}}
 */
function addCustomRole(label, color = 'ghost') {
  const clean = String(label || '').trim();
  if (!clean) return { error: 'Le nom du rôle est obligatoire.' };
  if (getRoles()[slugifyRoleLabel(clean)]) return { error: 'Ce rôle existe déjà.' };

  const custom = getCustomRoles();
  const key = slugifyRoleLabel(clean);
  custom[key] = { label: clean, color, icon: 'tag', custom: true };
  saveToLocal('customRoles', custom);
  return { key };
}

function removeCustomRole(key) {
  const custom = getCustomRoles();
  if (!(key in custom)) return false;
  delete custom[key];
  saveToLocal('customRoles', custom);
  return true;
}

function getRoleBadge(role) {
  const r = getRoles()[role] || ROLES.membre;
  return `<span class="badge badge--${r.color}">${r.label}</span>`;
}

const STATUS = {
  actif: { label: 'Actif', color: 'success' },
  inactif: { label: 'Inactif', color: 'warning' },
  suspendu: { label: 'Suspendu', color: 'danger' }
};

function getStatusBadge(status) {
  const s = STATUS[status] || STATUS.actif;
  return `<span class="badge badge--${s.color} badge--dot">${s.label}</span>`;
}

// ==========================================
// Staggered Animations
// ==========================================

/**
 * Apply staggered fade-in animations to children
 */
function animateStaggered(parentSelector, childSelector, delay = 50) {
  const parent = document.querySelector(parentSelector);
  if (!parent) return;
  
  const children = parent.querySelectorAll(childSelector);
  children.forEach((child, index) => {
    child.style.opacity = '0';
    child.style.animation = `fadeInUp 0.4s ease forwards`;
    child.style.animationDelay = `${index * delay}ms`;
  });
}

// ==========================================
// Counter Animation
// ==========================================

/**
 * Animate a number counting up
 */
function animateCounter(element, target, duration = 1000) {
  const start = 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = Math.floor(start + (target - start) * eased);
    
    element.textContent = new Intl.NumberFormat('fr-FR').format(current);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

// ==========================================
// Local Storage Helpers (for demo mode)
// ==========================================

function saveToLocal(key, data) {
  try {
    localStorage.setItem(`tripa_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage unavailable:', e);
  }
}

function loadFromLocal(key) {
  try {
    const data = localStorage.getItem(`tripa_${key}`);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('LocalStorage unavailable:', e);
    return null;
  }
}

function removeFromLocal(key) {
  try {
    localStorage.removeItem(`tripa_${key}`);
  } catch (e) {
    console.warn('LocalStorage unavailable:', e);
  }
}

// ==========================================
// Couleur de l'application (palettes d'accent)
// Persistance : localStorage 'tripa_accent'.
// Les surcouches CSS vivent dans variables.css
// sous la forme html[data-accent="..."].
// ==========================================

const ACCENT_PALETTES = [
  { id: 'ambre',  label: 'Ambre (défaut)', color: '#f59e0b' },
  { id: 'bleu',   label: 'Bleu',           color: '#3b82f6' },
  { id: 'vert',   label: 'Vert',           color: '#10b981' },
  { id: 'violet', label: 'Violet',         color: '#8b5cf6' },
  { id: 'rouge',  label: 'Rouge',          color: '#ef4444' },
  { id: 'cyan',   label: 'Cyan',           color: '#06b6d4' },
  { id: 'rose',   label: 'Rose',           color: '#ec4899' }
];

function getAccent() {
  const saved = loadFromLocal('accent');
  return ACCENT_PALETTES.some(p => p.id === saved) ? saved : 'ambre';
}

function applyAccent(id) {
  const pid = ACCENT_PALETTES.some(p => p.id === id) ? id : 'ambre';
  if (pid === 'ambre') document.documentElement.removeAttribute('data-accent');
  else document.documentElement.setAttribute('data-accent', pid);
  return pid;
}

function setAccent(id) {
  const pid = applyAccent(id);
  saveToLocal('accent', pid);
  return pid;
}

// Applique la palette enregistrée dès le chargement de utils.js
applyAccent(getAccent());

// ==========================================
// Header enrichi de l'application (initHeader)
// Injecte date/heure, recherche, créations rapides,
// messages non lus, notifications, plein écran et
// menu profil dans <div id="headerActions">.
// ==========================================

let HEADER_CLOCK_TIMER = null;

function initHeader(profile) {
  const header = document.querySelector('.header');
  if (!header) return;

  let actions = document.getElementById('headerActions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'header__right';
    actions.id = 'headerActions';
    header.appendChild(actions);
  }
  if (actions.dataset.initialized === '1') return;
  actions.dataset.initialized = '1';

  const p = profile ||
    (typeof getSessionProfile === 'function' ? (getSessionProfile() || {}) : {}) || {};
  const initials = (getInitials(p.first_name, p.last_name) || 'AD').toUpperCase();
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Administrateur';
  const isSuper = (typeof isSuperAdminEmail === 'function' && isSuperAdminEmail(p.email)) ||
    p.role === 'super_admin';
  const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  // En-tête rangé en 4 zones : date · recherche · actions rapides · profil
  actions.innerHTML = `
    <div class="header__date" title="Date du jour">
      <i data-lucide="calendar-days"></i>
      <span id="hdrDate"></span><span class="header__date-sep">·</span><span id="hdrClock"></span>
    </div>

    <div class="header__divider" aria-hidden="true"></div>

    <div class="search-bar header__search">
      <i data-lucide="search"></i>
      <input type="text" id="headerSearch" class="form-input" placeholder="Rechercher...">
    </div>

    <div class="header__group">
      <div class="dropdown">
        <button class="btn btn--ghost btn--icon" data-dropdown-trigger title="Créer rapidement">
          <i data-lucide="plus-circle"></i>
        </button>
        <div class="dropdown__menu">
          <a class="dropdown__item" href="members.html"><i data-lucide="user-plus"></i> Nouveau membre</a>
          <a class="dropdown__item" href="meetings.html"><i data-lucide="calendar-plus"></i> Nouvelle réunion</a>
          <a class="dropdown__item" href="events.html"><i data-lucide="party-popper"></i> Nouvel événement</a>
          <a class="dropdown__item" href="votes.html"><i data-lucide="vote"></i> Nouveau vote</a>
          <a class="dropdown__item" href="projects.html"><i data-lucide="list-plus"></i> Nouvelle tâche</a>
          <div class="dropdown__divider"></div>
          <a class="dropdown__item" href="messages.html"><i data-lucide="mail-plus"></i> Nouveau message</a>
          <a class="dropdown__item" href="documents.html"><i data-lucide="upload"></i> Nouveau document</a>
        </div>
      </div>

      <button class="btn btn--ghost btn--icon header__menu-icon" onclick="window.location.href='messages.html'" title="Messagerie">
        <i data-lucide="mail"></i>
        <span class="header__count" id="hdrMsgCount" style="display:none;">0</span>
      </button>

      <div class="dropdown">
        <button class="btn btn--ghost btn--icon header__menu-icon" data-dropdown-trigger title="Notifications">
          <i data-lucide="bell"></i>
          <span class="badge badge--dot badge--primary header__bell-dot"></span>
        </button>
        <div class="dropdown__menu">
          <p class="dropdown__empty">Aucune nouvelle notification</p>
          <div class="dropdown__divider"></div>
          <a class="dropdown__item" href="messages.html"><i data-lucide="inbox"></i> Voir mes messages</a>
        </div>
      </div>
    </div>

    <div class="header__divider" aria-hidden="true"></div>

    <div class="header__group">
      <a class="btn btn--ghost btn--icon" href="settings.html#apparence" title="Couleur de l'application">
        <i data-lucide="palette"></i>
      </a>

      <button class="btn btn--ghost btn--icon" id="hdrFullscreenBtn" title="Plein écran">
        <i data-lucide="maximize"></i>
      </button>

      <div class="dropdown">
        <button class="btn btn--ghost header__profile" data-dropdown-trigger>
          <span class="avatar avatar--sm"><span class="avatar__initials">${escH(initials)}</span></span>
          <span class="header__name">${escH(fullName)}</span>
          <i data-lucide="chevron-down" class="icon-sm"></i>
        </button>
        <div class="dropdown__menu">
          <div class="dropdown__identity">
            <strong>${escH(fullName)}</strong>
            <span class="text-xs text-muted">${escH(p.email || '')}</span>
          </div>
          <div class="dropdown__divider"></div>
          <a class="dropdown__item" href="settings.html"><i data-lucide="user-cog"></i> Mon compte</a>
          <a class="dropdown__item" href="settings.html#apparence"><i data-lucide="palette"></i> Couleur de l'app</a>
          ${isSuper ? '<a class="dropdown__item" href="admin-management.html"><i data-lucide="shield-check"></i> Gestion des admins</a>' : ''}
          <div class="dropdown__divider"></div>
          <button class="dropdown__item dropdown__item--danger" id="hdrLogoutBtn"><i data-lucide="log-out"></i> Déconnexion</button>
        </div>
      </div>
    </div>`;

  // --- Date + heure en direct ---
  const tick = () => {
    const dEl = document.getElementById('hdrDate');
    const cEl = document.getElementById('hdrClock');
    if (!dEl || !cEl) return;
    const now = new Date();
    dEl.textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
    cEl.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };
  tick();
  if (HEADER_CLOCK_TIMER) clearInterval(HEADER_CLOCK_TIMER);
  HEADER_CLOCK_TIMER = setInterval(tick, 30000);

  // --- Recherche globale de page ---
  const search = document.getElementById('headerSearch');
  if (search) {
    search.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const target = document.getElementById('searchInput');
      if (target) {
        target.value = search.value;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        window.location.href = 'members.html';
      }
    });
  }

  // --- Plein écran ---
  const fsBtn = document.getElementById('hdrFullscreenBtn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', () => {
      fsBtn.innerHTML = `<i data-lucide="${document.fullscreenElement ? 'minimize' : 'maximize'}"></i>`;
      lucide.createIcons();
    });
  }

  // --- Déconnexion ---
  const logoutBtn = document.getElementById('hdrLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (typeof signOut === 'function') signOut();
      else window.location.href = 'index.html';
    });
  }

  // --- Compteur de messages non lus (via l'API si session active) ---
  if (typeof fetchAll === 'function' && typeof getSessionToken === 'function' && getSessionToken()) {
    fetchAll('messages', { limit: 500 }).then(({ data, error }) => {
      if (error || !Array.isArray(data)) return;
      const unread = data.filter(m => !m.is_read).length;
      const badge = document.getElementById('hdrMsgCount');
      if (badge && unread > 0) {
        badge.textContent = unread > 9 ? '9+' : String(unread);
        badge.style.display = 'inline-flex';
      }
    }).catch(() => {});
  }

  lucide.createIcons();
  if (typeof initDropdowns === 'function') initDropdowns();
}

// ==========================================
// Initialize Common Features
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initModals();
  initDropdowns();
  initHeader();
  
  // Set today's date where needed
  const dateElements = document.querySelectorAll('[data-today]');
  dateElements.forEach(el => {
    el.textContent = getTodayFormatted();
  });
  
  // Animate counters
  document.querySelectorAll('[data-count-to]').forEach(el => {
    const target = parseInt(el.getAttribute('data-count-to'));
    if (!isNaN(target)) {
      animateCounter(el, target);
    }
  });
});
