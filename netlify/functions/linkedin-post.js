const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const PROMPTS = [
  `Tu es un expert en investissement immobilier. Écris un post LinkedIn percutant en français de 150-200 mots sur un conseil pratique pour les investisseurs particuliers (1-5 biens). Format: accroche forte, 3-4 points clés, call-to-action vers bailo.pro. Termine par: "Gérez votre patrimoine avec Bailo Pro → bailo.pro #investissementimmobilier #gestionlocative #patrimoine"`,
  `Tu es Sébastien, fondateur de Bailo Pro, un SaaS immobilier pour investisseurs particuliers. Écris un post LinkedIn authentique en français de 150-200 mots sur les coulisses du développement. Termine par: "Découvrez Bailo Pro → bailo.pro #SaaS #immobilier #entrepreneuriat #buildinpublic"`
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

    // 3. Publier via nouvelle API LinkedIn /rest/posts
    const liResp = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${linkedinToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202501',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        author: 'urn:li:person:8bnOMf7pAD',
        commentary: postText,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      })
    });

    const liText = await liResp.text();
    console.log('LinkedIn response status:', liResp.status);
    console.log('LinkedIn response:', liText);

    if (!liResp.ok) throw new Error(`LinkedIn API error: ${liText}`);

    // 4. Logger dans Supabase
    await supabase.from('linkedin_posts').insert({
      content: postText,
      type: promptIndex === 0 ? 'conseil_immo' : 'coulisses_bailo',
      linkedin_id: liResp.headers.get('x-restli-id') || 'unknown',
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
