const { createClient } = require('@supabase/supabase-js');
exports.handler = async function(event) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  try {
    const { code } = JSON.parse(event.body);
    const params = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: 'https://bailo.pro/linkedin-callback', client_id: '785wpwp22qbyaa', client_secret: 'WPL_AP1.BLEUWeNPKsLMU3go.SDxxNQ==' });
    const resp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
    const data = await resp.json();
    if (data.access_token) {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      await supabase.from('settings').upsert({ key: 'linkedin_token', value: data.access_token, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...cors }, body: JSON.stringify({ access_token: data.access_token }) };
    }
    return { statusCode: 400, headers: cors, body: JSON.stringify(data) };
  } catch(err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
