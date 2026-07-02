const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PRICE_IDS = {
  bailleur:     'price_1TomXuCayy0ySKyou002vhU',
  investisseur: 'price_1TomfQCayy0ySKyoLxzFjWKe',
  pro:          'price_1TomiYCayy0ySKyo7cIcfCMv'
};
const MODULE_URLS = {
  gestion:    'https://gestion.bailo.pro',
  chantier:   'https://chantier.bailo.pro',
  finance:    'https://finance.bailo.pro',
  bnb:        'https://bnb.bailo.pro',
  patrimoine: 'https://patrimoine.bailo.pro'
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
