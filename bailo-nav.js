(function() {
  const SUPABASE_CHANTIER_URL = 'https://hvkguyddmhqbvarujlyr.supabase.co';
  const SUPABASE_CHANTIER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a2d1eWRkbWhxYnZhcnVqbHlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTYxNzE3NzksImV4cCI6MjAxMTc0Nzc3OX0.tDMR-E5kaPJgBHxGhEJAQsIGFQZ7_8fHE_bKs8o8_bA';
  const AUTH_KEY = 'sb-hvkguyddmhqbvarujlyr-auth-token';
  const ADMIN_ID = 'd762ecb9-c06d-49b6-b058-f0aacfa7952c';

  const MODULES = [
    { id: 'finance',  label: 'Finance',  desc: 'Faisabilité & banque', url: 'https://finance.bailo.pro' },
    { id: 'chantier', label: 'Chantier', desc: 'Suivi travaux',        url: 'https://chantier.bailo.pro' },
    { id: 'gestion',  label: 'Gestion',  desc: 'Locataires',           url: 'https://gestion.bailo.pro' }
  ]; 

  function getCurrentModule() {
    const host = window.location.hostname;
    if (host.includes('finance')) return 'finance';
    if (host.includes('chantier')) return 'chantier';
    if (host.includes('gestion')) return 'gestion';
    return null;
  }

  async function getToken() {
    // 1. Via le client db existant sur la page (priorite absolue)
    if (window.db && window.db.auth) {
      try {
        const { data } = await window.db.auth.getSession();
        if (data && data.session) return data.session.access_token;
      } catch(e) {}
    }

    // 2. Scan localStorage toutes cles
    for (const k of Object.keys(localStorage)) {
      try {
        const val = JSON.parse(localStorage.getItem(k));
        if (val && val.access_token) return val.access_token;
        if (val && val.session && val.session.access_token) return val.session.access_token;
      } catch(e) {}
    }

    return null;
  }

  function getTokenData() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return {};
  }

  async function getUserModules(token) {
    // Priorité : window.userModules déjà chargé par la page hôte
    if (window.userModules && window.userModules.length > 0) {
      return window.userModules;
    }
    // Attendre jusqu'à 3 secondes que la page hôte charge les modules
    for (var i = 0; i < 6; i++) {
      await new Promise(function(r){ setTimeout(r, 500); });
      if (window.userModules && window.userModules.length > 0) {
        return window.userModules;
      }
    }
    // Fallback : requête Supabase directe
    if (!token) return [];
    try {
      const res = await fetch(SUPABASE_CHANTIER_URL + '/rest/v1/subscriptions?select=modules,active&limit=1', {
        headers: {
          'apikey': SUPABASE_CHANTIER_KEY,
          'Authorization': 'Bearer ' + token
        }
      });
      const data = await res.json();
      if (data && data[0] && data[0].active) return data[0].modules || [];
      return [];
    } catch(e) { return []; }
  }

  function getUserId(token) {
    try {
      return JSON.parse(atob(token.split('.')[1])).sub;
    } catch(e) { return null; }
  }

  function injectStyles() {
    if (document.getElementById('bailo-nav-styles')) return;
    const style = document.createElement('style');
    style.id = 'bailo-nav-styles';
    style.textContent = `
      #bailo-nav {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        z-index: 9999; display: flex; align-items: center; gap: 4px;
        background: rgba(15,15,13,0.92); border: 1px solid rgba(255,255,255,0.09);
        border-radius: 99px; padding: 6px 8px;
        backdrop-filter: blur(16px); box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        font-family: system-ui, -apple-system, sans-serif;
      }
      #bailo-nav .bn-logo {
        font-size: 13px; font-weight: 700; color: #f97316;
        padding: 0 10px 0 6px; letter-spacing: -0.3px;
        border-right: 1px solid rgba(255,255,255,0.08); margin-right: 2px; white-space: nowrap;
      }
      #bailo-nav .bn-btn {
        display: flex; align-items: center; gap: 6px; padding: 7px 14px;
        border-radius: 99px; border: none; background: transparent;
        color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 500;
        cursor: pointer; text-decoration: none; transition: all 0.2s; white-space: nowrap;
      }
      #bailo-nav .bn-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); }
      #bailo-nav .bn-btn.active { background: rgba(249,115,22,0.15); color: #f97316; }
      #bailo-nav .bn-btn.locked { color: rgba(255,255,255,0.25); }
      #bailo-nav .bn-btn.locked:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4); }
      #bailo-nav .bn-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.6; flex-shrink: 0; }
      #bailo-nav-tooltip {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        z-index: 10000; background: rgba(15,15,13,0.97);
        border: 1px solid rgba(249,115,22,0.3); border-radius: 14px;
        padding: 16px 20px; width: 280px; font-family: system-ui, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6); display: none;
      }
      #bailo-nav-tooltip .bnt-title { font-size: 14px; font-weight: 700; color: #f0ede8; margin-bottom: 6px; }
      #bailo-nav-tooltip .bnt-desc { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.5; margin-bottom: 14px; }
      #bailo-nav-tooltip .bnt-cta { display: block; background: #f97316; color: white; text-decoration: none; text-align: center; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; }
      #bailo-nav-tooltip .bnt-close { position: absolute; top: 10px; right: 12px; background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 16px; }
    `;
    document.head.appendChild(style);
  }

  function buildNav(userModules, userId) {
    if (document.getElementById('bailo-nav')) return;
    const currentMod = getCurrentModule();
    const nav = document.createElement('div');
    nav.id = 'bailo-nav';

    const logo = document.createElement('div');
    logo.className = 'bn-logo';
    logo.textContent = 'Bailo';
    nav.appendChild(logo);

    MODULES.forEach(function(mod) {
      const hasAccess = userModules.includes(mod.id);
      const isActive = mod.id === currentMod;
      const btn = document.createElement('a');
      btn.className = 'bn-btn' + (isActive ? ' active' : '') + (!hasAccess ? ' locked' : '');
      btn.href = hasAccess ? mod.url : '#';

      const dot = document.createElement('span');
      dot.className = 'bn-dot';
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(mod.label));

      if (!hasAccess) {
        const lock = document.createElement('span');
        lock.style.cssText = 'font-size:11px;opacity:0.5;margin-left:2px';
        lock.textContent = '↗';
        btn.appendChild(lock);
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          showUpsellTooltip(mod);
        });
      }
      nav.appendChild(btn);
    });

    // Bouton admin uniquement pour Sébastien
    if (userId === ADMIN_ID) {
      var tokenData = getTokenData();
      var accessToken = tokenData.access_token || '';
      var refreshToken = tokenData.refresh_token || '';
      var adminBtn = document.createElement('a');
      adminBtn.href = 'https://bailo.pro/admin?token=' + accessToken + '&refresh=' + refreshToken;
      adminBtn.className = 'bn-btn';
      adminBtn.style.cssText = 'color:#f97316;opacity:0.6;font-size:11px;padding:7px 10px';
      adminBtn.title = 'Admin';
      adminBtn.textContent = '⚙';
      nav.appendChild(adminBtn);
    }

    document.body.appendChild(nav);

    const tooltip = document.createElement('div');
    tooltip.id = 'bailo-nav-tooltip';
    tooltip.innerHTML = '<button class="bnt-close" onclick="document.getElementById(\'bailo-nav-tooltip\').style.display=\'none\'">×</button><div class="bnt-title" id="bnt-title"></div><div class="bnt-desc" id="bnt-desc"></div><a class="bnt-cta" href="https://bailo.pro/#inscription">Compléter mon Bailo</a>';
    document.body.appendChild(tooltip);

    document.addEventListener('click', function(e) {
      const t = document.getElementById('bailo-nav-tooltip');
      if (t && !t.contains(e.target) && !nav.contains(e.target)) t.style.display = 'none';
    });
  }

  function showUpsellTooltip(mod) {
    const tooltip = document.getElementById('bailo-nav-tooltip');
    document.getElementById('bnt-title').textContent = 'Bailo ' + mod.label + ' non activé';
    document.getElementById('bnt-desc').textContent = 'Ce module ne fait pas partie de votre plan. Complétez votre Bailo pour y accéder.';
    tooltip.style.display = 'block';
  }

  async function init() {
    injectStyles();
    let attempts = 0;
    const tryInit = async function() {
      attempts++;
      const token = await getToken();
      if (!token && attempts < 15) {
        setTimeout(tryInit, 500);
        return;
      }
      const modules = await getUserModules(token);
      const userId = token ? getUserId(token) : null;
      buildNav(modules, userId);
    };
    tryInit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
