const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hvkguyddmhqbvarujlyr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { plan, modules, email, userId } = JSON.parse(event.body);

    // Vérifier le nombre d'abonnés actifs
    const { count, error: countError } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    if (countError) throw new Error(countError.message);
    if (count >= 10) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ eligible: false })
      };
    }

    // Créer l'abonnement gratuit 3 mois
    const trialEnds = new Date();
    trialEnds.setMonth(trialEnds.getMonth() + 3);

    const { error } = await supabase.from('subscriptions').upsert({
      user_id:    userId,
      email:      email,
      plan:       plan,
      modules:    Array.isArray(modules) ? modules.join(',') : modules,
      active:     true,
      trial:      true,
      expires_at: trialEnds.toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);

    // Email de bienvenue offre lancement
    await resend.emails.send({
      from: 'Bailo Pro <contact@bailo.pro>',
      to:   email,
      subject: '🎉 Vos 3 mois offerts sont activés — Bailo Pro',
      html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d0c0b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0c0b;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#141210;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="background:#e8793a;height:4px;"></td></tr>
        <tr><td style="padding:32px 40px 0;">
          <span style="font-size:22px;font-weight:900;color:#f5f0eb;">Bailo</span>
          <span style="font-size:11px;font-weight:600;color:#f5f0eb;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:1px 6px;margin-left:4px;">Pro</span>
        </td></tr>
        <tr><td style="padding:28px 40px 32px;">
          <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#e8793a;text-transform:uppercase;margin:0 0 10px;">Offre de lancement</p>
          <h1 style="font-size:26px;font-weight:900;color:#f5f0eb;margin:0 0 16px;line-height:1.2;">Vous faites partie des 10 premiers !</h1>
          <p style="font-size:15px;color:rgba(245,240,235,0.7);line-height:1.6;margin:0 0 24px;">
            Félicitations — votre accès <strong style="color:#f5f0eb;">Bailo Pro</strong> est activé gratuitement pendant <strong style="color:#e8793a;">3 mois</strong>. Aucun paiement requis, accès immédiat à tous vos modules.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:rgba(232,121,58,0.1);border:1px solid rgba(232,121,58,0.25);border-radius:10px;padding:14px 20px;">
              <p style="margin:0;font-size:12px;color:rgba(245,240,235,0.5);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Accès gratuit jusqu'au</p>
              <p style="margin:0;font-size:17px;font-weight:700;color:#e8793a;">${trialEnds.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </td></tr>
          </table>
          <p style="font-size:13px;color:rgba(245,240,235,0.5);margin:0;">À l'issue de la période gratuite, vous recevrez un email pour choisir de continuer avec un abonnement payant.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ eligible: true, expires_at: trialEnds.toISOString() })
    };

  } catch (err) {
    console.error('Trial error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
