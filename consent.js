// Bailo — consentement à la mesure d'audience (Google Analytics 4).
// Rien n'est chargé ni déposé tant que le visiteur n'a pas accepté.
// Refuser est aussi simple qu'accepter ; le choix est gardé 6 mois et peut
// être modifié à tout moment (lien « Gérer les cookies » en pied de page).
(function () {
  'use strict';
  var GA_ID = 'G-XBNHP7PGN2';
  var KEY = 'bailo_cookie_consent';
  var SIX_MONTHS = 1000 * 60 * 60 * 24 * 182;
  var granted = false, loaded = false;

  window.dataLayer = window.dataLayer || [];
  // Sans accord, gtag() ne fait rien : aucun événement n'est mis en file.
  window.gtag = function () { if (granted) window.dataLayer.push(arguments); };

  function readChoice() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && (v.c === 'granted' || v.c === 'denied') && Date.now() - v.t < SIX_MONTHS) return v.c;
    } catch (e) {}
    return null;
  }
  function saveChoice(c) { try { localStorage.setItem(KEY, JSON.stringify({ c: c, t: Date.now() })); } catch (e) {} }

  function loadGA() {
    if (internal) return; // navigateur de l'équipe Bailo : jamais compté
    granted = true;
    window['ga-disable-' + GA_ID] = false;
    if (loaded) return;
    loaded = true;
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }
  function stopGA() {
    granted = false;
    window['ga-disable-' + GA_ID] = true;
    // Efface les cookies de mesure déjà déposés
    try {
      var host = location.hostname, parts = host.split('.');
      var domains = [host, '.' + host];
      if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
      document.cookie.split(';').forEach(function (c) {
        var name = c.split('=')[0].trim();
        if (name.indexOf('_ga') !== 0) return;
        domains.forEach(function (d) { document.cookie = name + '=; Max-Age=0; path=/; domain=' + d; });
        document.cookie = name + '=; Max-Age=0; path=/';
      });
    } catch (e) {}
  }

  function hide() { var b = document.getElementById('bailo-consent'); if (b) b.remove(); }
  function show() {
    if (document.getElementById('bailo-consent')) return;
    var box = document.createElement('div');
    box.id = 'bailo-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Cookies de mesure d\'audience');
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:560px;margin:0 auto;background:#fff;color:#1a1d2e;border:1px solid #d8dbe5;border-radius:14px;box-shadow:0 12px 40px rgba(20,24,40,.18);padding:16px 18px;font:14px/1.5 "DM Sans",system-ui,sans-serif';
    var p = document.createElement('p');
    p.style.cssText = 'margin:0 0 12px';
    p.appendChild(document.createTextNode('Nous utilisons Google Analytics pour mesurer la fréquentation du site, uniquement avec votre accord. Aucun cookie publicitaire. '));
    var more = document.createElement('a');
    more.href = '/legal.html#cookies';
    more.textContent = 'En savoir plus';
    more.style.cssText = 'color:#3b5bdb';
    p.appendChild(more);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px';
    function btn(label, primary, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'flex:1;padding:10px 12px;border-radius:9px;font:inherit;font-weight:600;cursor:pointer;border:1px solid #3b5bdb;' + (primary ? 'background:#3b5bdb;color:#fff' : 'background:#fff;color:#3b5bdb');
      b.onclick = fn;
      return b;
    }
    row.appendChild(btn('Refuser', false, function () { saveChoice('denied'); stopGA(); hide(); }));
    row.appendChild(btn('Accepter', true, function () { saveChoice('granted'); loadGA(); hide(); }));
    box.appendChild(p); box.appendChild(row);
    document.body.appendChild(box);
  }

  window.bailoCookies = { open: show };

  // Envoi d'un événement de mesure (sans effet tant que le visiteur n'a pas accepté).
  window.bailoTrack = function (name, params) {
    try { window.gtag('event', name, params || {}); } catch (e) {}
  };

  // Exclusion de l'équipe Bailo : ouvrir une fois n'importe quelle page avec
  // ?notrack=1 pour que ce navigateur ne soit plus jamais compté (ni bandeau,
  // ni Google Analytics). ?notrack=0 annule.
  var NO_TRACK = 'bailo_no_track', internal = false;
  try {
    var nt = new URLSearchParams(location.search).get('notrack');
    if (nt === '1') localStorage.setItem(NO_TRACK, '1');
    if (nt === '0') localStorage.removeItem(NO_TRACK);
    internal = localStorage.getItem(NO_TRACK) === '1';
  } catch (e) {}
  if (internal) { stopGA(); return; }

  var choice = readChoice();
  if (choice === 'granted') loadGA();
  else if (choice === null) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
  }
})();
