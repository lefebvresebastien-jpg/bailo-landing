const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BASE_STYLE = `
  background:#0d0c0b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
`;
const CARD_STYLE = `
  background:#141210;border-radius:16px;border:1px solid rgba(255,255,255,0.08);
  overflow:hidden;max-width:560px;width:100%;
`;
const ORANGE_BAR = `background:linear-gradient(90deg,#e8793a,#d4531f);height:4px;`;
const LOGO = `
  <span style="font-size:22px;font-weight:900;color:#f5f0eb;">Bailo</span>
  <span style="font-size:11px;font-weight:600;color:#f5f0eb;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:1px 6px;margin-left:4px;">Pro</span>
`;
const CTA_BTN = (url, text) => `
  <a href="${url}" style="display:inline-block;background:#e8793a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;margin-top:24px;">${text}</a>
`;
const FOOTER = `
  <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;font-size:12px;color:rgba(245,240,235,0.35);text-align:center;">
      Bailo Pro · <a href="https://bailo.pro" style="color:#e8793a;text-decoration:none;">bailo.pro</a>
      · <a href="https://bailo.pro/unsubscribe" style="color:rgba(245,240,235,0.35);text-decoration:none;">Se désabonner</a>
    </p>
  </td></tr>
`;

function wrap(body) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;${BASE_STYLE}">
  <table width="100%" cellpadding="0" cellspacing="0" style="${BASE_STYLE}padding:40px 0;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="${CARD_STYLE}">
        <tr><td style="${ORANGE_BAR}"></td></tr>
        <tr><td style="padding:32px 40px 0;">${LOGO}</td></tr>
        ${body}
        ${FOOTER}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const EMAILS = {
  // J+0 — Bienvenue
  welcome: (email) => ({
    to: email,
    subject: '🎉 Bienvenue sur Bailo Pro — votre patrimoine vous remercie',
    html: wrap(`
      <tr><td style="padding:28px 40px 32px;">
        <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#e8793a;text-transform:uppercase;margin:0 0 10px;">Bienvenue</p>
        <h1 style="font-size:24px;font-weight:900;color:#f5f0eb;margin:0 0 16px;line-height:1.2;">Votre accès Bailo Pro est actif ✅</h1>
        <p style="font-size:15px;color:rgba(245,240,235,0.7);line-height:1.6;margin:0 0 20px;">
          Vous avez maintenant accès aux 3 modules pour gérer votre patrimoine immobilier de A à Z.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
          <tr>
            <td style="background:rgba(26,86,219,0.1);border:1px solid rgba(26,86,219,0.25);border-radius:8px;padding:12px 16px;width:30%;">
              <p style="margin:0;font-size:11px;color:#1a56db;font-weight:700;text-transform:uppercase;">Finance</p>
              <p style="margin:4px 0 0;font-size:12px;color:rgba(245,240,235,0.6);">Budget & TVA</p>
            </td>
            <td style="width:4%;"></td>
            <td style="background:rgba(232,121,58,0.1);border:1px solid rgba(232,121,58,0.25);border-radius:8px;padding:12px 16px;width:30%;">
              <p style="margin:0;font-size:11px;color:#e8793a;font-weight:700;text-transform:uppercase;">Chantier</p>
              <p style="margin:4px 0 0;font-size:12px;color:rgba(245,240,235,0.6);">Travaux & artisans</p>
            </td>
            <td style="width:4%;"></td>
            <td style="background:rgba(5,122,85,0.1);border:1px solid rgba(5,122,85,0.25);border-radius:8px;padding:12px 16px;width:30%;">
              <p style="margin:0;font-size:11px;color:#057a55;font-weight:700;text-transform:uppercase;">Gestion</p>
              <p style="margin:4px 0 0;font-size:12px;color:rgba(245,240,235,0.6);">Baux & loyers</p>
            </td>
          </tr>
        </table>
        ${CTA_BTN('https://gestion.bailo.pro', 'Accéder à Bailo Pro →')}
      </td></tr>
    `)
  }),

  // J+3 — Tips
  tips: (email) => ({
    to: email,
    subject: '3 astuces pour tirer le maximum de Bailo Pro',
    html: wrap(`
      <tr><td style="padding:28px 40px 32px;">
        <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#e8793a;text-transform:uppercase;margin:0 0 10px;">Conseils</p>
        <h1 style="font-size:24px;font-weight:900;color:#f5f0eb;margin:0 0 20px;line-height:1.2;">3 astuces pour bien démarrer</h1>

        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
          <tr><td style="background:#1a1a2e;border-left:3px solid #1a56db;border-radius:0 8px 8px 0;padding:14px 16px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#f5f0eb;">💡 Astuce 1 — Créez votre premier bail en 5 min</p>
            <p style="margin:6px 0 0;font-size:12px;color:rgba(245,240,235,0.6);">Dans Bailo Gestion, l'éditeur de bail génère automatiquement toutes les clauses légales. Vous n'avez qu'à remplir les infos du locataire.</p>
          </td></tr>
        </table>

        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
          <tr><td style="background:#1a1a2e;border-left:3px solid #e8793a;border-radius:0 8px 8px 0;padding:14px 16px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#f5f0eb;">💡 Astuce 2 — Suivez vos chantiers avec des jalons</p>
            <p style="margin:6px 0 0;font-size:12px;color:rgba(245,240,235,0.6);">Dans Bailo Chantier, créez des jalons pour chaque étape de vos travaux. Vos artisans ont leur propre espace pour mettre à jour l'avancement.</p>
          </td></tr>
        </table>

        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
          <tr><td style="background:#1a1a2e;border-left:3px solid #057a55;border-radius:0 8px 8px 0;padding:14px 16px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#f5f0eb;">💡 Astuce 3 — Préparez votre dossier banquier en 1 clic</p>
            <p style="margin:6px 0 0;font-size:12px;color:rgba(245,240,235,0.6);">Bailo Finance génère automatiquement votre dossier banquier avec les données de vos chantiers et revenus locatifs. Idéal pour votre prochain investissement.</p>
          </td></tr>
        </table>

        ${CTA_BTN('https://gestion.bailo.pro', 'Découvrir toutes les fonctionnalités →')}
      </td></tr>
    `)
  }),

  // J+7 — Upsell
  upsell: (email) => ({
    to: email,
    subject: 'Comment se passe votre première semaine sur Bailo Pro ?',
    html: wrap(`
      <tr><td style="padding:28px 40px 32px;">
        <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#e8793a;text-transform:uppercase;margin:0 0 10px;">Votre avis compte</p>
        <h1 style="font-size:24px;font-weight:900;color:#f5f0eb;margin:0 0 16px;line-height:1.2;">Une semaine avec Bailo Pro 🎯</h1>
        <p style="font-size:15px;color:rgba(245,240,235,0.7);line-height:1.6;margin:0 0 20px;">
          Vous avez maintenant une semaine d'expérience avec Bailo Pro. Votre avis nous aide à améliorer le produit.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
          <tr><td style="background:rgba(232,121,58,0.08);border:1px solid rgba(232,121,58,0.2);border-radius:10px;padding:16px 20px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#f5f0eb;margin-bottom:12px;">Recommanderiez-vous Bailo Pro ?</p>
            <a href="https://bailo.pro?avis=oui" style="display:inline-block;background:#057a55;color:#fff;text-decoration:none;padding:8px 20px;border-radius:8px;font-size:12px;font-weight:700;margin-right:8px;">👍 Oui</a>
            <a href="https://bailo.pro?avis=non" style="display:inline-block;background:rgba(255,255,255,0.08);color:#f5f0eb;text-decoration:none;padding:8px 20px;border-radius:8px;font-size:12px;font-weight:700;">👎 Pas encore</a>
          </td></tr>
        </table>
        <p style="font-size:13px;color:rgba(245,240,235,0.5);line-height:1.6;margin:0 0 20px;">
          Vous pouvez aussi répondre directement à cet email — je lis tous les retours personnellement.
        </p>
        ${CTA_BTN('https://gestion.bailo.pro', 'Continuer sur Bailo Pro →')}
      </td></tr>
    `)
  })
};

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { type, email } = JSON.parse(event.body);

    if (!EMAILS[type]) return { statusCode: 400, body: JSON.stringify({ error: 'Type invalide' }) };
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Email manquant' }) };

    // SÉCURITÉ (corrigé le 13/07/2026) : cette fonction envoyait un email
    // marketing à N'IMPORTE QUELLE adresse fournie, sans vérification —
    // un relais de spam potentiel utilisant la réputation du domaine Bailo.
    // On exige maintenant qu'un vrai abonné existe pour cet email avant
    // d'envoyer quoi que ce soit.
    const { data: sub } = await supabase.from('subscriptions').select('email').ilike('email', email).limit(1).maybeSingle();
    if (!sub) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Aucun abonné trouvé pour cet email' }) };
    }

    const emailData = EMAILS[type](email);
    await resend.emails.send({
      from: 'Sébastien · Bailo Pro <contact@bailo.pro>',
      ...emailData
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ sent: true, type })
    };
  } catch (err) {
    console.error('Email sequence error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
