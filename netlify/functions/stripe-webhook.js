const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hvkguyddmhqbvarujlyr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const PLAN_LABELS = {
  bailleur:     'Bailleur — 9,90€/mois',
  investisseur: 'Investisseur — 19,90€/mois',
  pro:          'Complet — 29,90€/mois',
  // Alias "complet" corrigé le 16/07/2026, voir PLAN_MODULES plus bas.
  complet:      'Complet — 29,90€/mois',
};

async function sendConfirmationEmail(email, plan, gestionPasswordLink) {
  const planLabel = PLAN_LABELS[plan] || plan;

  await resend.emails.send({
    from: 'Bailo Pro <contact@bailo.pro>',
    to:   email,
    subject: 'Votre abonnement Bailo Pro est actif',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0d0c0b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0c0b;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#141210;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;max-width:560px;width:100%;">

          <tr>
            <td style="background:linear-gradient(90deg,#f4622a,#d4531f);height:4px;"></td>
          </tr>

          <tr>
            <td style="padding:32px 40px 0;">
              <span style="font-size:22px;font-weight:900;color:#f5f0eb;letter-spacing:-0.5px;">Bailo</span>
              <span style="font-size:11px;font-weight:600;color:#f5f0eb;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:1px 6px;margin-left:4px;letter-spacing:0.5px;">Pro</span>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 16px;">
              <p style="font-size:11px;font-weight:600;letter-spacing:2px;color:#f4622a;text-transform:uppercase;margin:0 0 10px;">Confirmation de paiement</p>
              <h1 style="font-size:28px;font-weight:900;color:#f5f0eb;margin:0 0 16px;line-height:1.1;">Votre abonnement est actif</h1>
              <p style="font-size:15px;color:rgba(245,240,235,0.7);line-height:1.6;margin:0 0 24px;">
                Merci pour votre confiance. Votre accès à <strong style="color:#f5f0eb;">Bailo Pro</strong> est maintenant activé.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:rgba(244,98,42,0.1);border:1px solid rgba(244,98,42,0.25);border-radius:10px;padding:14px 20px;">
                    <p style="margin:0;font-size:12px;color:rgba(245,240,235,0.5);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Plan souscrit</p>
                    <p style="margin:0;font-size:17px;font-weight:700;color:#f4622a;">${planLabel}</p>
                  </td>
                </tr>
              </table>

              ${gestionPasswordLink ? `
              <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;width:100%;">
                <tr>
                  <td style="background:rgba(59,91,219,.1);border:1px solid rgba(59,91,219,.3);border-radius:10px;padding:16px 20px;">
                    <p style="margin:0 0 10px;font-size:13px;color:#3b5bdb;font-weight:700;">🔑 Dernière étape avant de commencer</p>
                    <p style="margin:0 0 12px;font-size:13px;color:#f5f0eb;">Définissez votre mot de passe pour accéder à Bailo Gestion :</p>
                    <a href="${gestionPasswordLink}" style="display:inline-block;background:#3b5bdb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">Définir mon mot de passe Gestion →</a>
                  </td>
                </tr>
              </table>` : ''}

              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f4622a;border-radius:10px;">
                    <a href="https://bailo.pro/welcome" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Configurer mon espace →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0;" />
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 32px;">
              <p style="font-size:13px;color:rgba(245,240,235,0.35);line-height:1.6;margin:0;">
                Une question ? Répondez à cet email ou écrivez-nous à
                <a href="mailto:contact@bailo.pro" style="color:#f4622a;text-decoration:none;">contact@bailo.pro</a><br/>
                Bailo Pro · Gestion locative & chantier
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const meta    = session.metadata || {};
    const plan    = meta.plan || 'bailleur';
    const PLAN_MODULES = {
  bailleur:     ['gestion', 'finance'],
  investisseur: ['gestion', 'finance', 'chantier'],
  pro:          ['gestion', 'finance', 'chantier', 'bnb', 'patrimoine'],
  // CORRIGÉ (16/07/2026) : la page de vente envoie plan="complet" (bouton
  // "Choisir Complet"), pas "pro" -- sans cet alias, un client payant
  // l'offre à 29,90€ ne recevait accès qu'à Gestion (fallback ['gestion']),
  // moins que l'offre Bailleur à 9,90€. Découvert lors d'une vérification
  // demandée par Sébastien après le retour client de Kevin Olivier.
  complet:      ['gestion', 'finance', 'chantier', 'bnb', 'patrimoine'],
};
const modules = PLAN_MODULES[plan] || (meta.modules ? meta.modules.split(',') : ['gestion']);
    const userId  = meta.user_id || null;
    const email   = session.customer_email || null;

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    try {
      if (userId) {
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id:            userId,
            email,
            plan:               plan,
            modules:            modules,
            active:             true,
            stripe_customer_id: session.customer,
            stripe_sub_id:      session.subscription,
            expires_at:         expiresAt.toISOString(),
            updated_at:         new Date().toISOString()
          }, { onConflict: 'user_id' });
        if (error) console.error('Supabase upsert error:', error);
        else console.log(`Abonnement activé pour user ${userId} — plan ${plan}`);
      } else if (email) {
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            email:              email,
            plan:               plan,
            modules:            modules,
            active:             true,
            stripe_customer_id: session.customer,
            stripe_sub_id:      session.subscription,
            expires_at:         expiresAt.toISOString(),
            updated_at:         new Date().toISOString()
          }, { onConflict: 'email' });
        if (error) console.error('Supabase upsert by email error:', error);
        else console.log(`Abonnement activé pour email ${email} — plan ${plan}`);
      }
    } catch (e) {
      console.error('Supabase error:', e);
    }

    // Créer le compte dans Supabase Gestion (base séparée) + lien de
    // définition de mot de passe. Sans ça, un client payant n'a AUCUN
    // moyen de se connecter à Bailo Gestion (aucun compte n'y existe).
    let gestionPasswordLink = null;
    if (email) {
      try {
        const GESTION_URL = 'https://nltuysmnxsomlhgvbtwz.supabase.co';
        const GESTION_SERVICE_KEY = process.env.SUPABASE_GESTION_SERVICE_KEY;

        if (GESTION_SERVICE_KEY) {
          const supabaseGestion = createClient(GESTION_URL, GESTION_SERVICE_KEY);

          const { data: gestionUser, error: gestionAuthError } = await supabaseGestion.auth.admin.createUser({
            email: email,
            password: Math.random().toString(36).slice(-10) + 'A1!',
            email_confirm: true
          });

          let gestionUserId = gestionUser?.user?.id;

          if (gestionAuthError) {
            if (gestionAuthError.message.includes('already been registered')) {
              const { data: existingList } = await supabaseGestion.auth.admin.listUsers();
              const existingUser = (existingList?.users || []).find(u => u.email === email);
              gestionUserId = existingUser?.id || null;
            } else {
              console.error('Gestion auth error (webhook):', gestionAuthError);
            }
          }

          if (gestionUserId) {
            await supabaseGestion.from('subscriptions').upsert({
              user_id: gestionUserId,
              email: email,
              plan: plan,
              modules: modules,
              active: true,
              expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            console.log(`Compte Gestion créé/mis à jour (webhook): ${email}`);

            const { data: linkData, error: linkError } = await supabaseGestion.auth.admin.generateLink({
              type: 'recovery',
              email: email,
              options: { redirectTo: 'https://gestion.bailo.pro/reset-password.html' }
            });
            if (linkError) {
              console.error('Erreur génération lien mot de passe Gestion (webhook):', linkError);
            } else {
              gestionPasswordLink = linkData?.properties?.action_link || null;
            }
          }
        }
      } catch (gestionErr) {
        console.error('Erreur création compte Gestion (webhook):', gestionErr);
        // Non bloquant — l'abonnement Chantier/Finance est déjà activé
      }
    }

    if (email) {
      try {
        await sendConfirmationEmail(email, plan, gestionPasswordLink);
        console.log(`Email de confirmation envoyé à ${email}`);
      } catch (e) {
        console.error('Resend error:', e);
      }
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const sub = stripeEvent.data.object;
    const { error } = await supabase
      .from('subscriptions')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('stripe_sub_id', sub.id);
    if (error) console.error('Supabase deactivate error:', error);
    else console.log(`Abonnement désactivé: ${sub.id}`);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
