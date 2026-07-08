const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

exports.handler = async function(event) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  console.log('create-trial called');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'OK' : 'MISSING');
  console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'OK' : 'MISSING');
  console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'OK' : 'MISSING');

  try {
    const { plan, modules, email, userId } = JSON.parse(event.body);
    console.log('Input:', { plan, email, userId, modules });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Compter les abonnés — tous sauf le compte owner
    const OWNER_ID = 'd762ecb9-c06d-49b6-b058-f0aacfa7952c';
    const { data: allSubs, error: countError } = await supabase
      .from('subscriptions')
      .select('user_id');

    console.log('allSubs:', allSubs, 'countError:', countError);

    if (countError) {
      console.error('Count error:', countError);
      // En cas d'erreur de lecture, on accorde le bénéfice du doute = eligible
      console.log('Fallback: granting trial due to count error');
    }

    const otherSubs = (allSubs || []).filter(s => s.user_id !== OWNER_ID && s.user_id !== userId);
    console.log('otherSubs count:', otherSubs.length);

    if (!countError && otherSubs.length >= 10) {
      console.log('Max trials reached');
      return { statusCode: 200, headers, body: JSON.stringify({ eligible: false }) };
    }

    // Créer l'abonnement trial
    const trialEnds = new Date();
    trialEnds.setMonth(trialEnds.getMonth() + 3);

    const { error: upsertError } = await supabase.from('subscriptions').upsert({
      user_id: userId,
      email: email,
      plan: 'pro',
      modules: ['gestion', 'finance', 'chantier', 'bnb', 'patrimoine'],
      trial: true,
      expires_at: trialEnds.toISOString(),
      started_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    console.log('upsert error:', upsertError);
    if (upsertError) console.error('Upsert error:', upsertError);

    // Email de bienvenue
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'Bailo Pro <contact@bailo.pro>',
        to: email,
        subject: '🎉 Vos 3 mois offerts sont activés — Bailo Pro Complet',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#141210;border-radius:16px;padding:32px;color:#f5f0eb">
          <h1 style="color:#e8793a">Vous faites partie des 10 premiers !</h1>
          <p>Votre accès <strong>Bailo Pro Complet</strong> (5 modules) est activé gratuitement pendant <strong>3 mois</strong>.</p>
          <p>Accès gratuit jusqu'au : <strong>${trialEnds.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
          <div style="margin:20px 0;padding:16px;background:rgba(232,121,58,.1);border-radius:8px;border:1px solid rgba(232,121,58,.3)">
            <p style="margin:0;font-size:13px;color:#e8793a;font-weight:600">Vos 5 modules inclus :</p>
            <p style="margin:8px 0 0;font-size:13px;color:#f5f0eb">🏠 Bailo Gestion &nbsp;·&nbsp; 💰 Bailo Finance &nbsp;·&nbsp; 🏗 Bailo Chantier &nbsp;·&nbsp; 🏖 Bailo Bnb &nbsp;·&nbsp; 📊 Bailo Patrimoine</p>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
            <a href="https://gestion.bailo.pro" style="display:inline-block;background:#e8793a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">🏠 Bailo Gestion →</a>
            <a href="https://finance.bailo.pro" style="display:inline-block;background:#3b5bdb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">💰 Bailo Finance →</a>
            <a href="https://chantier.bailo.pro" style="display:inline-block;background:#e8793a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">🏗 Bailo Chantier →</a>
            <a href="https://bnb.bailo.pro" style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">🏖 Bailo Bnb →</a>
            <a href="https://patrimoine.bailo.pro" style="display:inline-block;background:#0f766e;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">📊 Bailo Patrimoine →</a>
          </div>
          <p style="margin-top:24px;font-size:13px;color:#8a8880">À l'issue de la période gratuite, vous recevrez un email pour choisir de continuer avec un abonnement payant à partir de 9,90€/mois.</p>
        </div>`
      });
      console.log('Email sent to:', email);
    } catch(emailErr) {
      console.error('Email error (non-blocking):', emailErr.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ eligible: true, expires_at: trialEnds.toISOString() })
    };

  } catch (err) {
    console.error('create-trial FATAL error:', err.message, err.stack);
    // Même en cas d'erreur fatale, on tente de renvoyer eligible: true
    // pour ne pas bloquer les utilisateurs
    const trialEnds = new Date();
    trialEnds.setMonth(trialEnds.getMonth() + 3);
    return { 
      statusCode: 200, 
      headers,
      body: JSON.stringify({ eligible: true, expires_at: trialEnds.toISOString() })
    };
  }
};
