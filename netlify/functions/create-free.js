// Netlify Function — création d'un compte sur l'offre Gratuite (1 logement,
// module Gestion seul, sans limite de durée ni carte bancaire).
//
// Même principe que create-trial.js : le navigateur crée d'abord le compte
// (auth Chantier/Finance), puis appelle cette fonction, qui inscrit
// l'abonnement « gratuit », crée le compte Bailo Gestion (base séparée) et
// envoie par email le lien de définition du mot de passe Gestion.
//
// Sécurité :
//  - on vérifie que userId existe bien et correspond à l'email reçu ;
//  - on ne modifie JAMAIS un abonnement existant (sinon n'importe qui
//    pourrait rétrograder un client payant en appelant cette fonction).

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const GESTION_URL = 'https://nltuysmnxsomlhgvbtwz.supabase.co';
const FREE_PLAN = { plan: 'gratuit', modules: ['gestion'], trial: false, active: true, expires_at: null };

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

// Informations saisies sur /quittance-de-loyer-gratuite, transmises par le
// navigateur au moment de l'inscription (texte simple, longueur bornée).
function cleanPrefill(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const txt = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').trim().slice(0, max) : '');
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n >= 0 && n < 1000000 ? String(Math.round(n * 100) / 100) : ''; };
  const out = {
    landlordName: txt(raw.landlordName, 120), landlordAddress: txt(raw.landlordAddress, 240),
    signatureCity: txt(raw.signatureCity, 80), tenantName: txt(raw.tenantName, 160),
    propertyAddress: txt(raw.propertyAddress, 240), rent: num(raw.rent), charges: num(raw.charges)
  };
  return Object.values(out).some(Boolean) ? out : null;
}

// Le filtre ?email= de l'API Admin n'est pas fiable : on parcourt toutes
// les pages et on compare l'email exact.
async function findUserByEmail(client, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const users = data?.users || [];
    const hit = users.find(u => (u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method Not Allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const email = String(body.email || '').trim().toLowerCase();
    const prefill = cleanPrefill(body.prefill);
    const userId = String(body.userId || '').trim();
    if (!email || !userId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return reply(400, { error: 'Email ou identifiant manquant.' });
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return reply(500, { error: 'Configuration serveur incomplète.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // 1. Le compte doit exister et porter cet email
    const { data: found, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr || !found?.user || (found.user.email || '').toLowerCase() !== email) {
      return reply(403, { error: 'Compte introuvable. Recommencez l\'inscription.' });
    }

    // 2. Ne jamais écraser un abonnement existant (essai, payant ou gratuit)
    const byId = await supabase.from('subscriptions').select('plan').eq('user_id', userId).limit(1);
    const byEmail = await supabase.from('subscriptions').select('plan').eq('email', email).limit(1);
    if (byId.error || byEmail.error) {
      console.error('create-free lecture subscriptions:', byId.error || byEmail.error);
      return reply(500, { error: 'Vérification du compte impossible. Réessayez dans un instant.' });
    }
    const existing = (byId.data || []).concat(byEmail.data || []);
    if (existing.length) {
      return reply(200, { created: false, existing: true, plan: existing[0].plan });
    }

    // 3. Abonnement gratuit (base Chantier/Finance, lue par check-plan)
    const now = new Date().toISOString();
    const { error: insErr } = await supabase.from('subscriptions').insert({
      user_id: userId, email, started_at: now, ...FREE_PLAN
    });
    if (insErr) {
      console.error('create-free insertion subscriptions:', insErr);
      return reply(500, { error: 'Création de l\'offre gratuite impossible. Écrivez-nous à contact@bailo.pro.' });
    }

    // 4. Compte Bailo Gestion + lien de définition du mot de passe
    let gestionPasswordLink = null;
    try {
      const GESTION_SERVICE_KEY = process.env.SUPABASE_GESTION_SERVICE_KEY;
      if (GESTION_SERVICE_KEY) {
        const gestion = createClient(GESTION_URL, GESTION_SERVICE_KEY);
        const { data: created, error: createErr } = await gestion.auth.admin.createUser({
          email,
          password: require('crypto').randomBytes(18).toString('base64') + 'aA1!',
          email_confirm: true
        });
        let gestionUserId = created?.user?.id || null;
        if (createErr) {
          const existingUser = await findUserByEmail(gestion, email);
          gestionUserId = existingUser?.id || null;
          if (!gestionUserId) console.error('create-free compte Gestion:', createErr);
        }
        if (gestionUserId) {
          // Pas d'écrasement non plus côté Gestion
          const { data: gSub } = await gestion.from('subscriptions').select('plan').eq('user_id', gestionUserId).limit(1);
          if (!gSub || !gSub.length) {
            const { error: gErr } = await gestion.from('subscriptions').insert({
              user_id: gestionUserId, email, started_at: now, ...FREE_PLAN
            });
            if (gErr) console.error('create-free subscriptions Gestion:', gErr);
          }
          // Compte tout neuf uniquement : on prépare son profil bailleur et
          // les éléments du futur bail à partir de la quittance saisie.
          if (prefill && created?.user?.id) {
            try {
              const rows = [];
              if (prefill.landlordName || prefill.landlordAddress) {
                rows.push({ bailleur_id: gestionUserId, key: 'landlord_profile', value: JSON.stringify({
                  landlordName: prefill.landlordName, landlordRepresentative: '',
                  landlordAddress: prefill.landlordAddress.replace(/\n+/g, ', '),
                  landlordEmail: email, signatureCity: prefill.signatureCity
                }) });
              }
              if (prefill.tenantName || prefill.propertyAddress || prefill.rent) {
                rows.push({ bailleur_id: gestionUserId, key: 'quittance_prefill', value: JSON.stringify({
                  tenantName: prefill.tenantName, propertyAddress: prefill.propertyAddress.replace(/\n+/g, ', '),
                  rent: prefill.rent, charges: prefill.charges
                }) });
              }
              if (rows.length) {
                const { error: pErr } = await gestion.from('settings').upsert(rows, { onConflict: 'bailleur_id,key' });
                if (pErr) console.error('create-free reprise quittance:', pErr);
              }
            } catch (e) { console.error('create-free reprise quittance (non bloquant):', e.message); }
          }

          const { data: linkData, error: linkErr } = await gestion.auth.admin.generateLink({
            type: 'recovery', email,
            options: { redirectTo: 'https://gestion.bailo.pro/reset-password.html' }
          });
          if (linkErr) console.error('create-free lien mot de passe:', linkErr);
          else gestionPasswordLink = linkData?.properties?.action_link || null;
        }
      }
    } catch (e) {
      console.error('create-free Gestion (non bloquant):', e);
    }

    // 5. Email de bienvenue
    let emailSent = false;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const bouton = gestionPasswordLink
        ? `<p style="margin:0 0 12px">Dernière étape : choisissez votre mot de passe pour ouvrir Bailo Gestion.</p>
           <a href="${gestionPasswordLink}" style="display:inline-block;background:#3b5bdb;color:#fff;padding:12px 22px;border-radius:9px;text-decoration:none;font-weight:700">Choisir mon mot de passe →</a>`
        : `<p style="margin:0 0 12px">Pour ouvrir Bailo Gestion, cliquez sur « Mot de passe oublié » à la première connexion afin de choisir votre mot de passe.</p>
           <a href="https://gestion.bailo.pro" style="display:inline-block;background:#3b5bdb;color:#fff;padding:12px 22px;border-radius:9px;text-decoration:none;font-weight:700">Ouvrir Bailo Gestion →</a>`;
      await resend.emails.send({
        from: 'Bailo Pro <contact@bailo.pro>',
        to: email,
        subject: 'Votre compte Bailo gratuit est prêt',
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#1a1d2e;line-height:1.6">
          <h1 style="font-size:22px;margin:0 0 12px;color:#3b5bdb">Bienvenue sur Bailo</h1>
          <p>Votre compte <strong>Gratuit</strong> est activé : vous pouvez gérer <strong>1 logement</strong> avec Bailo Gestion, sans carte bancaire et sans limite de durée.</p>
          <div style="margin:22px 0;padding:18px;background:#eef1ff;border-radius:12px">${bouton}</div>
          <p style="margin:0 0 6px"><strong>Ce que vous pouvez faire dès maintenant :</strong></p>
          <ul style="margin:0 0 18px;padding-left:20px">
            <li>créer votre bail et la fiche de votre locataire ;</li>
            <li>suivre les loyers et générer les quittances ;</li>
            <li>donner à votre locataire l'accès à son espace.</li>
          </ul>
          <p style="font-size:13px;color:#6b7080">Un deuxième logement, la signature électronique des baux ou le module Finance ? Les offres payantes démarrent à 9,90 €/mois : <a href="https://bailo.pro/#tarifs" style="color:#3b5bdb">voir les offres</a>.</p>
          <p style="font-size:13px;color:#6b7080">Une question ? Répondez simplement à cet email.</p>
        </div>`
      });
      emailSent = true;
    } catch (e) {
      console.error('create-free email (non bloquant):', e.message);
    }

    return reply(200, { created: true, emailSent, passwordLinkSent: emailSent && !!gestionPasswordLink });
  } catch (err) {
    console.error('create-free erreur fatale:', err.message, err.stack);
    return reply(500, { error: 'Une erreur est survenue. Réessayez ou écrivez-nous à contact@bailo.pro.' });
  }
};
