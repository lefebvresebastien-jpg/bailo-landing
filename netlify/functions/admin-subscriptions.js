// Netlify Function — liste complète des abonnements pour le dashboard admin.
//
// CORRIGÉ (16/07/2026) : admin.html interrogeait directement Supabase avec
// la clé publique. Même en étant reconnu "admin" par la page (comparaison
// côté client de session.user.id), la requête restait soumise à la RLS de
// la table subscriptions (chaque utilisateur ne voit que SA PROPRE ligne)
// — Sébastien ne voyait donc jamais que son propre abonnement, jamais ceux
// des clients réels. Cette fonction vérifie le token CÔTÉ SERVEUR (pas
// juste un décodage JWT client, contournable) puis utilise la clé service
// pour renvoyer la liste complète, réservée au seul compte admin.

const https = require('https');

const SUPABASE_URL = 'https://hvkguyddmhqbvarujlyr.supabase.co';
const ANON_KEY = 'sb_publishable_BZHU49hkN70MgEypJZ7K5A_AwlIQF7W';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_ID = 'd762ecb9-c06d-49b6-b058-f0aacfa7952c';

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

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  if (!SERVICE_KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Configuration serveur incomplète' }) };

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Non authentifié' }) };

    const userRes = await fetchJson(SUPABASE_URL + '/auth/v1/user', {
      apikey: ANON_KEY, Authorization: 'Bearer ' + token
    });
    if (userRes.status !== 200 || userRes.body?.id !== ADMIN_ID) {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Accès refusé' }) };
    }

    const subsRes = await fetchJson(
      SUPABASE_URL + '/rest/v1/subscriptions?select=*&order=updated_at.desc',
      { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
    );
    return { statusCode: 200, headers: cors, body: JSON.stringify({ data: Array.isArray(subsRes.body) ? subsRes.body : [] }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
