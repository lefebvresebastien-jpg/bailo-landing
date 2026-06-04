const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const KEYWORDS = [
  'gestion locative', 'logiciel gestion', 'bail locatif', 'quittance loyer',
  'état des lieux', 'travaux locataire', 'suivi chantier', 'investissement locatif',
  'propriétaire bailleur', 'gestion patrimoine', 'TVA travaux', 'dossier banquier immobilier'
];

const SUBREDDITS = ['vosfinances', 'france', 'immobilier', 'investissement'];

async function searchReddit(subreddit, keyword) {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=5&restrict_sr=1`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'BailoProVeille/1.0' } });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.data?.children?.map(c => ({
    title: c.data.title,
    url: `https://reddit.com${c.data.permalink}`,
    created: new Date(c.data.created_utc * 1000).toISOString(),
    subreddit: c.data.subreddit,
    score: c.data.score
  })) || [];
}

exports.handler = async function(event) {
  try {
    const now = new Date();
    const since = new Date(now - 24 * 60 * 60 * 1000); // dernières 24h

    const allPosts = [];

    for (const subreddit of SUBREDDITS) {
      for (const keyword of KEYWORDS.slice(0, 4)) { // limiter les requêtes
        const posts = await searchReddit(subreddit, keyword);
        const recent = posts.filter(p => new Date(p.created) > since);
        allPosts.push(...recent);
        await new Promise(r => setTimeout(r, 500)); // rate limit
      }
    }

    // Dédupliquer
    const unique = allPosts.filter((p, i, arr) => arr.findIndex(x => x.url === p.url) === i);

    if (unique.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'Aucune opportunité aujourd\'hui' }) };
    }

    // Construire l'email
    const postsHtml = unique.map(p => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:13px;font-weight:700;color:#f5f0eb;">
            <a href="${p.url}" style="color:#e8793a;text-decoration:none;">r/${p.subreddit}</a>
          </p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(245,240,235,0.8);">${p.title}</p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(245,240,235,0.4);">
            ${new Date(p.created).toLocaleDateString('fr-FR')} · ${p.score} points
          </p>
        </td>
      </tr>
    `).join('');

    await resend.emails.send({
      from: 'Bailo Pro Veille <contact@bailo.pro>',
      to: 'lefebvresebastien@yahoo.fr',
      subject: `🔍 ${unique.length} opportunité(s) forum aujourd'hui — Bailo Pro`,
      html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d0c0b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0c0b;padding:40px 0;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="background:#141210;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(90deg,#e8793a,#d4531f);height:4px;"></td></tr>
        <tr><td style="padding:32px 40px 0;">
          <span style="font-size:22px;font-weight:900;color:#f5f0eb;">Bailo</span>
          <span style="font-size:11px;font-weight:600;color:#f5f0eb;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:1px 6px;margin-left:4px;">Pro</span>
        </td></tr>
        <tr><td style="padding:20px 40px 32px;">
          <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#e8793a;text-transform:uppercase;margin:0 0 10px;">Veille forums</p>
          <h1 style="font-size:20px;font-weight:900;color:#f5f0eb;margin:0 0 8px;">${unique.length} discussion(s) à saisir</h1>
          <p style="font-size:13px;color:rgba(245,240,235,0.6);margin:0 0 20px;">Ces posts parlent de gestion locative ou de travaux — parfait pour mentionner Bailo Pro.</p>
          <table cellpadding="0" cellspacing="0" style="width:100%;background:#1a1a2e;border-radius:10px;overflow:hidden;">
            ${postsHtml}
          </table>
          <div style="margin-top:20px;background:rgba(232,121,58,0.08);border:1px solid rgba(232,121,58,0.2);border-radius:10px;padding:14px 16px;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#f5f0eb;margin-bottom:6px;">💡 Rappel — réponse type :</p>
            <p style="margin:0;font-size:12px;color:rgba(245,240,235,0.6);line-height:1.6;">"J'ai eu le même problème. J'ai fini par créer Bailo Pro pour centraliser bail, quittances, travaux et finances. Essai gratuit sur bailo.pro"</p>
          </div>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:12px;color:rgba(245,240,235,0.35);text-align:center;">Bailo Pro · <a href="https://bailo.pro" style="color:#e8793a;text-decoration:none;">bailo.pro</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sent: true, opportunities: unique.length })
    };

  } catch (err) {
    console.error('Veille error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
