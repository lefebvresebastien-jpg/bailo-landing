const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async function(event) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  try {
    const { action, userId, email, refCode } = JSON.parse(event.body);

    // Action: générer un code parrainage pour un nouvel abonné
    if (action === 'generate') {
      const code = userId.substring(0, 8).toUpperCase();
      await supabase.from('referrals').upsert({ user_id: userId, email, code, referrals_count: 0 }, { onConflict: 'user_id' });
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ code, url: `https://bailo.pro?ref=${code}` }) };
    }

    // Action: appliquer le parrainage quand un filleul s'inscrit
    if (action === 'apply' && refCode) {
      if (!email) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Email filleul manquant' }) };

      // Trouver le parrain
      const { data: referrer } = await supabase.from('referrals').select('*').eq('code', refCode).single();
      if (!referrer) return { statusCode: 200, headers: cors, body: JSON.stringify({ valid: false }) };

      // SÉCURITÉ (corrigé le 13/07/2026) : cette action pouvait être
      // rejouée à l'infini avec le même refCode pour cumuler des mois
      // gratuits sans limite. On vérifie maintenant qu'un vrai abonné
      // existe pour l'email filleul, et qu'il n'a jamais déjà été
      // comptabilisé sur ce code de parrainage.
      const emailLower = (email || '').toLowerCase();
      const already = Array.isArray(referrer.referred_emails) && referrer.referred_emails.includes(emailLower);
      if (already) {
        return { statusCode: 200, headers: cors, body: JSON.stringify({ valid: false, reason: 'already_applied' }) };
      }
      const { data: filleulSub } = await supabase.from('subscriptions').select('email').ilike('email', emailLower).limit(1).maybeSingle();
      if (!filleulSub) {
        return { statusCode: 200, headers: cors, body: JSON.stringify({ valid: false, reason: 'no_subscription' }) };
      }

      // Ajouter 1 mois gratuit au parrain
      const { data: sub } = await supabase.from('subscriptions').select('expires_at').eq('user_id', referrer.user_id).single();
      if (sub) {
        const newExpiry = new Date(sub.expires_at);
        newExpiry.setMonth(newExpiry.getMonth() + 1);
        await supabase.from('subscriptions').update({ expires_at: newExpiry.toISOString() }).eq('user_id', referrer.user_id);
      }

      // Incrémenter le compteur et marquer cet email comme déjà traité
      const updatedEmails = [...(Array.isArray(referrer.referred_emails) ? referrer.referred_emails : []), emailLower];
      await supabase.from('referrals').update({
        referrals_count: (referrer.referrals_count || 0) + 1,
        referred_emails: updatedEmails
      }).eq('code', refCode);

      // Email au parrain
      await resend.emails.send({
        from: 'Bailo Pro <contact@bailo.pro>',
        to: referrer.email,
        subject: '🎉 Un ami vient de rejoindre Bailo Pro — 1 mois offert !',
        html: `<!DOCTYPE html><html><body style="background:#0d0c0b;font-family:sans-serif;padding:40px;">
          <div style="max-width:560px;margin:0 auto;background:#141210;border-radius:16px;border:1px solid rgba(255,255,255,.08);overflow:hidden;">
            <div style="background:linear-gradient(90deg,#e8793a,#d4531f);height:4px;"></div>
            <div style="padding:32px 40px;">
              <h1 style="color:#f5f0eb;font-size:22px;">Merci pour votre parrainage ! 🎉</h1>
              <p style="color:rgba(245,240,235,.7);line-height:1.6;">Un ami vient de s'inscrire avec votre lien. Nous vous avons offert <strong style="color:#e8793a;">1 mois gratuit</strong> en remerciement.</p>
              <p style="color:rgba(245,240,235,.7);">Vous avez parrainé <strong style="color:#e8793a;">${(referrer.referrals_count || 0) + 1} personne(s)</strong> au total.</p>
              <a href="https://gestion.bailo.pro" style="display:inline-block;background:#e8793a;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:16px;">Accéder à Bailo Pro →</a>
            </div>
          </div>
        </body></html>`
      });

      return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ valid: true, referrer_email: referrer.email }) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Action invalide' }) };

  } catch(err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};