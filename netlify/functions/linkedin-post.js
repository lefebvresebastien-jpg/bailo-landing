const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// CORRIGÉ (25/07/2026) — les posts précédents suivaient un schéma trop
// reconnaissable comme "généré par IA" : seulement 2 prompts vagues en
// boucle infinie ("accroche forte, 3-4 points, CTA"), sans aucun fait
// concret injecté → le modèle retombait systématiquement sur les mêmes
// formules ("X% des investisseurs font cette erreur", "Voici pourquoi").
// Corrigé avec : 1) une instruction anti-clichés explicite, 2) une banque
// de faits réels et précis à piocher (à enrichir au fil du temps avec de
// vrais événements vécus — c'est la spécificité qui rend un texte crédible,
// pas la formule), 3) plusieurs angles/formats différents pour éviter la
// répétition, 4) un modèle plus nuancé (Sonnet plutôt que Haiku).

const ANTI_CLICHES = `Règles strictes à respecter :
- INTERDIT : "X% des investisseurs/gens font cette erreur", "Voici pourquoi", "Vous pensez que... mais en fait", ou toute accroche basée sur une statistique inventée.
- INTERDIT : structure "accroche choc + liste à puces + CTA générique" — ça sonne artificiel.
- INTERDIT : les emojis en début de ligne façon liste (🏠 📊 ✅), le ton motivationnel de coach LinkedIn, les phrases qui se terminent toutes pareil.
- Écris comme si tu racontais un truc à un ami autour d'un café, pas comme si tu vendais quelque chose. Phrases de longueur variée, parfois courtes et cash, parfois plus posées.
- Un seul fait concret et vérifiable (donné ci-dessous) au cœur du post, pas trois généralités.
- Le lien vers bailo.pro peut apparaître naturellement à la fin, sans "Découvrez Bailo Pro →" à chaque fois — varie la formulation ou omets-le carrément si le post n'appelle pas à l'action.`;

// Faits réels et précis à réutiliser comme matière première — à COMPLÉTER
// régulièrement avec de vrais événements (un bug trouvé, un retour client,
// une décision produit, une anecdote du quotidien). Plus c'est spécifique
// et vrai, moins ça sonne IA.
const FAITS_REELS = [
  `Sébastien développe seul Bailo Pro EN PLUS de gérer deux commerces (une friterie et une pizzeria dans le Nord) et ses propres biens en SCI. Pas d'équipe, pas de levée de fonds — juste lui, le soir et le week-end.`,
  `Un audit de sécurité récent a révélé qu'un cron automatique envoyait par erreur les alertes de révision de loyer d'un client à un autre bailleur — bug invisible tant qu'un seul utilisateur existait, devenu actif dès les premiers vrais clients. Corrigé en quelques heures.`,
  `Un client (investisseur avec plusieurs biens) a testé l'app et fait un retour terrain concret : demande de signature électronique plus visible, alerte sur l'expiration du DPE (valable 10 ans), possibilité de supprimer un bien en double après une synchro automatique.`,
  `Un bug de calcul a un jour proposé une révision de loyer avec une augmentation de +3500% à cause d'une référence d'indice mal renseignée (juste "T4" au lieu du vrai chiffre) — corrigé avec un garde-fou qui bloque toute révision qui n'est pas dans une plage réaliste.`,
  `Le premier bug critique de Bailo Pro, découvert par un client au tout début : une règle de sécurité mal configurée permettait en théorie de voir les données d'un autre compte. Corrigé le jour même, audit complet fait derrière pour vérifier que rien d'autre ne clochait.`,
  `Bailo Pro est né d'un ras-le-bol très concret : gérer des biens en location avec des fichiers Excel, des relances de loyer à la main, et zéro visibilité sur la rentabilité réelle une fois tous les biens additionnés.`,
  `Le module Bailo Bnb a été pensé différemment du reste : pas juste "un bail de plus", mais une vraie logique de réservations qui s'enchaînent, avec la fiscalité spécifique du meublé de tourisme (loi Le Meur 2026) intégrée directement.`,
  `Un module entier (Bailo Patrimoine) a été reconstruit de zéro après avoir réalisé qu'il utilisait des données figées au lieu des vraies infos de chaque compte — leçon apprise à la dure sur l'importance de tester avec un second compte réel, pas juste le sien.`
];

const ANGLES = [
  `Raconte l'un des faits ci-dessous comme une anecdote vécue, avec un vrai avant/après (ce qui n'allait pas, ce qui a changé). Pas de morale appuyée à la fin, laisse le lecteur en tirer sa propre conclusion.`,
  `Pars du fait ci-dessous pour partager une leçon apprise en construisant seul un logiciel de gestion locative — ton direct, un peu autodérision si ça colle, sans grandiloquence.`,
  `Utilise le fait ci-dessous pour donner un conseil pratique et concret à un investisseur immobilier (pas une généralité formatée), en expliquant d'où vient ce conseil.`,
  `Raconte le fait ci-dessous comme un carnet de bord "coulisses" — ce que ça fait concrètement de développer seul un SaaS à côté d'autres activités.`
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

    // 2. Choisir un fait + un angle différents à chaque fois (rotation indépendante
    // pour multiplier les combinaisons et éviter les répétitions de structure)
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const fait = FAITS_REELS[weekNumber % FAITS_REELS.length];
    const angle = ANGLES[weekNumber % ANGLES.length];

    const prompt = `Tu es Sébastien, fondateur solo de Bailo Pro (SaaS de gestion locative/immobilière). Écris un post LinkedIn en français, 120-180 mots.

${angle}

Fait réel à utiliser comme matière première :
"${fait}"

${ANTI_CLICHES}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });
    const postText = message.content[0].text;

    // 3. Publier via ugcPosts (compatible w_member_social)
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
            shareCommentary: { text: postText },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
      })
    });

    const liText = await liResp.text();
    console.log('LinkedIn status:', liResp.status);
    console.log('LinkedIn response:', liText);

    if (!liResp.ok) throw new Error(`LinkedIn error: ${liText}`);

    await supabase.from('linkedin_posts').insert({
      content: postText,
      type: 'anecdote_reelle',
      linkedin_id: JSON.parse(liText).id || 'unknown',
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
