const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PRICE_IDS = {
  solo: 'price_1TayxuCayy0ySKyoIu9xY4rB',
  duo:  'price_1TayxtCayy0ySKyoRDAVwGZJ',
  pro:  'price_1TayxtCayy0ySKyomIKPSoP0'
};
const MODULE_URLS = {
  chantier: 'https://bailo-chantier.netlify.app',
  finance:  'https://finance.bailo.pro',
  gestion:  'https://gestion.bailo.pro'
};
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { plan, modules, email, userId } = JSON.parse(event.body);
    if (!plan || !PRICE_IDS[plan]) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Plan invalide' }) };
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: PRICE_IDS[plan],
        quantity: 1
      }],
      customer_email: email || undefined,
      success_url: 'https://bailo.pro/welcome?payment=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://bailo.pro?payment=cancelled',
      metadata: {
        plan: plan,
        modules: Array.isArray(modules) ? modules.join(',') : modules,
        user_id: userId || ''
      },
      subscription_data: {
        metadata: {
          plan: plan,
          modules: Array.isArray(modules) ? modules.join(',') : modules,
          user_id: userId || ''
        }
      },
      locale: 'fr'
    });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
