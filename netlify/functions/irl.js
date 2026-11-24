// Netlify Function — dernières valeurs de l'indice de référence des loyers (IRL)
//
// Interroge le service de données ouvertes de l'Insee (séries chronologiques,
// format SDMX) et renvoie les indices par zone et par trimestre :
//   { ok: true, updated: "2026-10-15", zones: { metropole: { "2026": [146.6, 148.37, 148.06, null] }, corse: {...}, outremer: {...} } }
//
// La page /calcul-revision-loyer-irl appelle cette fonction à chaque visite.
// Elle garde sa propre table en secours : si l'Insee ne répond pas, ou si la
// réponse a un format inattendu, la page continue de fonctionner avec les
// valeurs qu'elle connaît déjà.
//
// La réponse est mise en cache une demi-journée par le réseau Netlify : l'Insee
// n'est pas sollicité à chaque visite, et un nouvel indice apparaît sur la page
// au plus tard 12 heures après sa publication.

const https = require('https');

const SERIES = { metropole: '001515333', corse: '010760507', outremer: '010760509' };
const BASES = [
  'https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/',
  'https://api.insee.fr/series/BDM/data/SERIES_BDM/'
];

function get(url, redirects) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/xml', 'User-Agent': 'bailo.pro (calculateur IRL)' }, timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (redirects || 0) < 3) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), (redirects || 0) + 1));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function attr(tag, name) {
  const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"'));
  return m ? m[1] : null;
}

// Lit les séries d'une réponse SDMX : <Series IDBANK="…"> <Obs TIME_PERIOD="2026-Q3" OBS_VALUE="148.06"/> …
function parse(xml) {
  const byId = {}; let updated = null;
  const parts = xml.split(/<(?:[A-Za-z]+:)?Series\b/).slice(1);
  parts.forEach((part) => {
    const head = part.slice(0, part.indexOf('>') + 1);
    const id = attr(head, 'IDBANK');
    if (!id) return;
    const lu = attr(head, 'LAST_UPDATE');
    if (lu && (!updated || lu > updated)) updated = lu.slice(0, 10);
    const years = {};
    const re = /<(?:[A-Za-z]+:)?Obs\b([^>]*)>/g; let m;
    while ((m = re.exec(part))) {
      const p = (attr(m[1], 'TIME_PERIOD') || '').match(/^(\d{4})-Q([1-4])$/);
      const v = parseFloat(attr(m[1], 'OBS_VALUE'));
      if (!p || !(v > 100 && v < 300)) continue;
      if (!years[p[1]]) years[p[1]] = [null, null, null, null];
      years[p[1]][parseInt(p[2], 10) - 1] = Math.round(v * 100) / 100;
    }
    byId[id] = years;
  });
  return { byId, updated };
}

exports.parse = parse;

exports.handler = async () => {
  const ids = Object.values(SERIES).join('+');
  let lastError = 'aucune réponse';
  for (const base of BASES) {
    try {
      const r = await get(base + ids + '?lastNObservations=40');
      if (r.status !== 200) { lastError = 'HTTP ' + r.status; continue; }
      const { byId, updated } = parse(r.body);
      const zones = {};
      Object.keys(SERIES).forEach((z) => { if (byId[SERIES[z]] && Object.keys(byId[SERIES[z]]).length) zones[z] = byId[SERIES[z]]; });
      if (!zones.metropole) { lastError = 'format inattendu'; continue; }
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'Netlify-CDN-Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=604800'
        },
        body: JSON.stringify({ ok: true, source: 'Insee', updated, zones })
      };
    } catch (e) { lastError = e.message; }
  }
  return {
    statusCode: 502,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: false, error: lastError })
  };
};
