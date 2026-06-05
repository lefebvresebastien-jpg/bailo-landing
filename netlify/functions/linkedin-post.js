const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const LINKEDIN_PERSON_ID = '693763296';

const PROMPTS = [
  `Tu es un expert en investissement immobilier. Écris un post LinkedIn percutant en français de 150-200 mots sur un conseil pratique pour les investisseurs particuliers (1-5 biens). 
  Thèmes possibles: rentabilité, gestion locative, travaux, fiscalité, financement.
  Format: accroche forte, 3-4 points clés, call-to-action vers bailo.pro
  Ton: professionnel mais accessible, pas de jargon excessif.
  Termine par: "Gérez votre patrimoine avec Bailo Pro → bailo.pro #investissementimmobilier #gestionlocative #patrimoine"`,
  `Tu es Sébastien, fondateur de Bailo Pro, un SaaS immobilier pour investisseurs particuliers.
  Écris un post LinkedIn authentique en français de 150-200 mots sur les coulisses du développement de Bailo Pro.
  Thèmes: nouvelles fonctionnalités, apprentissages, vision produit, feedback utilisateurs.
  Format: storytelling personnel, concret, inspirant.
  Ton: authentique, entrepreneur solo, passionné.
  Termine par: "Découvrez Bailo Pro → bailo.pro #SaaS #immobilier #entrepreneuriat #buildinpublic"`
];

exports.handler = async function(event) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  try {
    // 1. Token LinkedIn
    const { data: tokenData, error: tokenError } = await supabase
      .from('settings').select('value').eq('key', 'linkedin_token').single();
    if (tokenError || !tokenData) throw new Error('Token LinkedIn non trouvé');
    const linkedinToken = tokenData.value;

    // 2. Générer le post avec Claude
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const promptIndex = weekNumber % 2;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: PROMPTS[promptIndex] }]
    });
    const postText = message.content[0].text;

    // 3. Récupérer le vrai person ID
    const meResp = await fetch('https://api.linkedin.com/v2/me', {
      headers: { 'Authorization': `Bearer ${linkedinToken}`, 'X-Restli-Protocol-Version': '2.0.0' }
    });
    const meData = await meResp.json();
    console.log('LinkedIn /v2/me response:', JSON.stringify(meData));
    const realPersonId = LINKEDIN_PERSON_ID; // ID hardcodé depuis URL profil LinkedIn

    // 4. Publier sur LinkedIn
    const liResp = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${linkedinToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        author: `urn:li:member:${LINKEDIN_PERSON_ID}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: postText },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
      })
    });

    const liData = await liResp.json();
    if (!liResp.ok) throw new Error(`LinkedIn API error: ${JSON.stringify(liData)}`);

    // 4. Logger dans Supabase
    await supabase.from('linkedin_posts').insert({
      content: postText,
      type: promptIndex === 0 ? 'conseil_immo' : 'coulisses_bailo',
      linkedin_id: liData.id,
      posted_at: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
      body: JSON.stringify({ success: true, post: postText.substring(0, 150) + '...' })
    };

  } catch (err) {
    console.error('LinkedIn post error:', err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
