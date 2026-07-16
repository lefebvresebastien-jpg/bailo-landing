// Netlify Function — compte le nombre d'inscriptions à l'offre de lancement
// (places restantes affichées sur la page d'accueil).
//
// CORRIGÉ (16/07/2026) : le compteur interrogeait directement Supabase
// depuis le navigateur avec la clé publique, soumise à la RLS qui ne
// laisse chaque utilisateur voir que SA PROPRE ligne dans subscriptions —
// donc le compteur voyait toujours 0 inscription (peu importe le nombre
// réel) et affichait "10 places" en permanence, jamais à jour. Cette
// fonction utilise la clé service (contourne légitimement la RLS pour un
// simple comptage public, sans exposer aucune donnée personnelle).

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OWNER_ID = 'd762ecb9-c06d-49b6-b058-f0aacfa7952c';

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async () => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (!SERVICE_KEY || !SUPABASE_URL) return { statusCode: 200, headers: cors, body: JSON.stringify({ count: 0 }) };

  try {
    const res = await fetchJson(
      SUPABASE_URL + '/rest/v1/subscriptions?select=user_id',
      { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
    );
    const subs = Array.isArray(res.body) ? res.body : [];
    const count = subs.filter(s => s.user_id !== OWNER_ID).length;
    return { statusCode: 200, headers: cors, body: JSON.stringify({ count }) };
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ count: 0, error: e.message }) };
  }
};
