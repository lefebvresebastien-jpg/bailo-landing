const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Même templates que email-sequence.js
const ORANGE_BAR = `background:linear-gradient(90deg,#e8793a,#d4531f);height:4px;`;
const LOGO = `<span style="font-size:22px;font-weight:900;color:#f5f0eb;">Bailo</span><span style="font-size:11px;font-weight:600;color:#f5f0eb;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:1px 6px;margin-left:4px;">Pro</span>`;
const FOOTER = `<tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);"><p style="margin:0;font-size:12px;color:rgba(245,240,235,0.35);text-align:center;">Bailo Pro · <a href="https://bailo.pro" style="color:#e8793a;text-decoration:none;">bailo.pro</a> · <a href="https://bailo.pro/unsubscribe" style="color:rgba(245,240,235,0.35);text-decoration:none;">Se désabonner</a></p></td></tr>`;

function wrap(body) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d0c0b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0c0b;padding:40px 0;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="background:#141210;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="${ORANGE_BAR}"></td></tr>
        <tr><td style="padding:32px 40px 0;">${LOGO}</td></tr>
        ${body}
        ${FOOTER}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendTips(email) {
  return resend.emails.send({
    from: 'Sébastien · Bailo Pro <contact@bailo.pro>',
    to: email,
    subject: '3 astuces pour tirer le maximum de Bailo Pro',
    html: wrap(`
      <tr><td style="padding:28px 40px 32px;">
        <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#e8793a;text-transform:uppercase;margin:0 0 10px;">Conseils</p>
        <h1 style="font-size:24px;font-weight:900;color:#f5f0eb;margin:0 0 20px;">3 astuces pour bien démarrer</h1>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;"><tr><td style="background:#1a1a2e;border-left:3px solid #1a56db;border-radius:0 8px 8px 0;padding:14px 16px;"><p style="margin:0;font-size:13px;font-weight:700;color:#f5f0eb;">💡 Créez votre premier bail en 5 min</p><p style="margin:6px 0 0;font-size:12px;color:rgba(245,240,235,0.6);">L'éditeur de bail génère automatiquement toutes les clauses légales.</p></td></tr></table>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;"><tr><td style="background:#1a1a2e;border-left:3px solid #e8793a;border-radius:0 8px 8px 0;padding:14px 16px;"><p style="margin:0;font-size:13px;font-weight:700;color:#f5f0eb;">💡 Suivez vos chantiers avec des jalons</p><p style="margin:6px 0 0;font-size:12px;color:rgba(245,240,235,0.6);">Vos artisans ont leur propre espace pour mettre à jour l'avancement.</p></td></tr></table>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;"><tr><td style="background:#1a1a2e;border-left:3px solid #057a55;border-radius:0 8px 8px 0;padding:14px 16px;"><p style="margin:0;font-size:13px;font-weight:700;color:#f5f0eb;">💡 Préparez votre dossier banquier en 1 clic</p><p style="margin:6px 0 0;font-size:12px;color:rgba(245,240,235,0.6);">Bailo Finance génère automatiquement votre dossier avec toutes vos données.</p></td></tr></table>
        <a href="https://gestion.bailo.pro" style="display:inline-block;background:#e8793a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;">Découvrir toutes les fonctionnalités →</a>
      </td></tr>
    `)
  });
}

async function sendUpsell(email) {
  return resend.emails.send({
    from: 'Sébastien · Bailo Pro <contact@bailo.pro>',
    to: email,
    subject: 'Comment se passe votre première semaine sur Bailo Pro ?',
    html: wrap(`
      <tr><td style="padding:28px 40px 32px;">
        <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#e8793a;text-transform:uppercase;margin:0 0 10px;">Votre avis compte</p>
        <h1 style="font-size:24px;font-weight:900;color:#f5f0eb;margin:0 0 16px;">Une semaine avec Bailo Pro 🎯</h1>
        <p style="font-size:15px;color:rgba(245,240,235,0.7);line-height:1.6;margin:0 0 20px;">Votre avis nous aide à améliorer le produit — répondez directement à cet email.</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;"><tr><td style="background:rgba(232,121,58,0.08);border:1px solid rgba(232,121,58,0.2);border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#f5f0eb;margin-bottom:12px;">Recommanderiez-vous Bailo Pro ?</p>
          <a href="https://bailo.pro?avis=oui" style="display:inline-block;background:#057a55;color:#fff;text-decoration:none;padding:8px 20px;border-radius:8px;font-size:12px;font-weight:700;margin-right:8px;">👍 Oui</a>
          <a href="https://bailo.pro?avis=non" style="display:inline-block;background:rgba(255,255,255,0.08);color:#f5f0eb;text-decoration:none;padding:8px 20px;border-radius:8px;font-size:12px;font-weight:700;">👎 Pas encore</a>
        </td></tr></table>
        <a href="https://gestion.bailo.pro" style="display:inline-block;background:#e8793a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;">Continuer sur Bailo Pro →</a>
      </td></tr>
    `)
  });
}

exports.handler = async function(event) {
  try {
    const now = new Date();

    // J+3 : abonnés créés il y a exactement 3 jours
    const j3Start = new Date(now); j3Start.setDate(j3Start.getDate() - 3); j3Start.setHours(0,0,0,0);
    const j3End = new Date(j3Start); j3End.setHours(23,59,59,999);

    const { data: j3Users } = await supabase
      .from('subscriptions')
      .select('email')
      .eq('active', true)
      .gte('updated_at', j3Start.toISOString())
      .lte('updated_at', j3End.toISOString());

    for (const u of (j3Users || [])) {
      await sendTips(u.email);
      console.log(`J+3 tips envoyé à ${u.email}`);
    }

    // J+7 : abonnés créés il y a exactement 7 jours
    const j7Start = new Date(now); j7Start.setDate(j7Start.getDate() - 7); j7Start.setHours(0,0,0,0);
    const j7End = new Date(j7Start); j7End.setHours(23,59,59,999);

    const { data: j7Users } = await supabase
      .from('subscriptions')
      .select('email')
      .eq('active', true)
      .gte('updated_at', j7Start.toISOString())
      .lte('updated_at', j7End.toISOString());

    for (const u of (j7Users || [])) {
      await sendUpsell(u.email);
      console.log(`J+7 upsell envoyé à ${u.email}`);
    }


    // J-7 : abonnés trial qui expirent dans 7 jours
    const exp7Start = new Date(now);
    exp7Start.setDate(exp7Start.getDate() + 7);
    exp7Start.setHours(0,0,0,0);
    const exp7End = new Date(exp7Start);
    exp7End.setHours(23,59,59,999);

    const { data: expUsers } = await supabase
      .from('subscriptions')
      .select('email')
      .eq('trial', true)
      .eq('active', true)
      .gte('expires_at', exp7Start.toISOString())
      .lte('expires_at', exp7End.toISOString());

    for (const u of (expUsers || [])) {
      await fetch(process.env.URL + '/.netlify/functions/email-j7-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email })
      });
      console.log(`J-7 conversion envoye a ${u.email}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ j3: j3Users?.length || 0, j7: j7Users?.length || 0, exp7: expUsers?.length || 0 })
    };

  } catch (err) {
    console.error('Cron email error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
