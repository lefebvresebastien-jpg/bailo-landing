const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async function(event) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  try {
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const from = in7days.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const to = in7days.toISOString().split('T')[0] + 'T23:59:59.999Z';

    const { data: subscribers, error } = await supabase
      .from('subscriptions')
      .select('email, user_id')
      .eq('trial', true)
      .eq('active', true)
      .gte('expires_at', from)
      .lte('expires_at', to);

    if (error) throw error;
    if (!subscribers || subscribers.length === 0) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ sent: 0, message: 'Aucun abonne a relancer' }) };
    }

    let sent = 0;
    for (const sub of subscribers) {
      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d0c0b;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0c0b;padding:40px 0;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="background:#141210;border-radius:16px;border:1px solid rgba(255,255,255,0.08);max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(90deg,#e8793a,#d4531f);height:4px;"></td></tr>
        <tr><td style="padding:32px 40px 0;">
          <span style="font-size:22px;font-weight:900;color:#f5f0eb;">Bailo</span>
          <span style="font-size:11px;font-weight:600;color:#f5f0eb;background:rgba(255,255,255,0.1);border-radius:4px;padding:1px 6px;margin-left:4px;">Pro</span>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#f5f0eb;">Plus que 7 jours sur votre periode gratuite</h2>
          <p style="margin:0 0 16px;font-size:15px;color:rgba(245,240,235,0.7);line-height:1.6;">Votre acces gratuit a Bailo Pro se termine dans <strong style="color:#e8793a;">7 jours</strong>.</p>
          <p style="margin:0 0 16px;font-size:15px;color:rgba(245,240,235,0.7);line-height:1.6;">Pour continuer sans interruption, choisissez votre plan :</p>
          <ul style="margin:8px 0 24px;padding-left:20px;color:rgba(245,240,235,0.7);font-size:14px;line-height:1.8;">
            <li><strong style="color:#f5f0eb;">Solo 15€/mois</strong> - 1 module</li>
            <li><strong style="color:#f5f0eb;">Duo 29€/mois</strong> - 2 modules</li>
            <li><strong style="color:#e8793a;">Pro 39€/mois</strong> - Tout inclus</li>
          </ul>
          <a href="https://bailo.pro/#tarifs" style="display:inline-block;background:#e8793a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;">Choisir mon plan</a>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:12px;color:rgba(245,240,235,0.35);text-align:center;">Bailo Pro · <a href="https://bailo.pro" style="color:#e8793a;text-decoration:none;">bailo.pro</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

      await resend.emails.send({
        from: 'Bailo Pro <hello@bailo.pro>',
        to: sub.email,
        subject: 'Plus que 7 jours sur votre periode gratuite',
        html: html
      });
      sent++;
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ success: true, sent }) };

  } catch (err) {
    console.error('Email J-7 error:', err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
