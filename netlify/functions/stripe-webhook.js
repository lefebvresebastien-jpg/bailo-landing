const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hvkguyddmhqbvarujlyr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // ── Paiement réussi ──────────────────────────────────────
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const meta = session.metadata || {};

    const plan    = meta.plan || 'solo';
    const modules = meta.modules ? meta.modules.split(',') : ['chantier'];
    const userId  = meta.user_id || null;
    const email   = session.customer_email || null;

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    try {
      if (userId) {
        // Mettre à jour l'abonnement existant
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id:            userId,
            plan:               plan,
            modules:            modules,
            active:             true,
            stripe_customer_id: session.customer,
            stripe_sub_id:      session.subscription,
            expires_at:         expiresAt.toISOString(),
            updated_at:         new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (error) console.error('Supabase upsert error:', error);
        else console.log(`✅ Abonnement activé pour user ${userId} — plan ${plan}`);

      } else if (email) {
        // Fallback par email si pas de user_id
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
        else console.log(`✅ Abonnement activé pour email ${email} — plan ${plan}`);
      }
    } catch (e) {
      console.error('Supabase error:', e);
    }
  }

  // ── Abonnement annulé ────────────────────────────────────
  if (stripeEvent.type === 'customer.subscription.deleted') {
    const sub = stripeEvent.data.object;
    const { error } = await supabase
      .from('subscriptions')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('stripe_sub_id', sub.id);

    if (error) console.error('Supabase deactivate error:', error);
    else console.log(`🔴 Abonnement désactivé: ${sub.id}`);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

