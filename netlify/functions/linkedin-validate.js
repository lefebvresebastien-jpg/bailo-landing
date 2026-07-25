const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Netlify Function — appelée quand Sébastien clique "Publier" ou "Ne pas
// publier" dans l'email de brouillon envoyé par linkedin-post.js. Vérifie
// l'id + le token avant toute action, pour qu'un lien deviné ou intercepté
// ne permette pas de publier un post à sa place.

function page(title, message, color) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
    <body style="font-family:sans-serif;background:#f5f0ea;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px">
      <div style="background:white;border-radius:12px;padding:32px;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <h1 style="font-size:20px;margin-bottom:8px;color:${color}">${title}</h1>
        <p style="color:#6a5a40;font-size:14px">${message}</p>
      </div>
    </body></html>`
  };
}

exports.handler = async function(event) {
  const { id, token, action } = event.queryStringParameters || {};
  if (!id || !token || !action) return page('Lien invalide', 'Paramètres manquants.', '#dc2626');

  const { data: postRow, error } = await supabase
    .from('linkedin_posts')
    .select('*')
    .eq('id', id)
    .eq('validation_token', token)
    .single();

  if (error || !postRow) return page('Lien invalide ou expiré', 'Ce brouillon est introuvable — peut-être déjà traité.', '#dc2626');
  if (postRow.status !== 'pending') return page('Déjà traité', `Ce post a déjà été marqué "${postRow.status}".`, '#6a5a40');

  if (action === 'rejeter') {
    await supabase.from('linkedin_posts').update({ status: 'rejected' }).eq('id', id);
    return page('Post écarté', 'Ce brouillon ne sera pas publié.', '#6a5a40');
  }

  if (action === 'publier') {
    try {
      const { data: tokenData, error: tokenError } = await supabase
        .from('settings').select('value').eq('key', 'linkedin_token').single();
      if (tokenError || !tokenData) throw new Error('Token LinkedIn non trouvé');
      const linkedinToken = tokenData.value;

      const liResp = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${linkedinToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          author: 'urn:li:person:8bnOMf7pAD',
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: postRow.content },
              shareMediaCategory: 'NONE'
            }
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
        })
      });

      const liText = await liResp.text();
      if (!liResp.ok) throw new Error(`Erreur LinkedIn: ${liText}`);

      await supabase.from('linkedin_posts').update({
        status: 'published',
        linkedin_id: JSON.parse(liText).id || 'unknown',
        posted_at: new Date().toISOString()
      }).eq('id', id);

      return page('Post publié ✅', 'Ton post est en ligne sur LinkedIn.', '#16a34a');
    } catch (err) {
      return page('Erreur de publication', err.message, '#dc2626');
    }
  }

  return page('Action inconnue', 'Ni "publier" ni "rejeter".', '#dc2626');
};
