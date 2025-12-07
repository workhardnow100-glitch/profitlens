// /pages/api/truelayer/callback.js
import axios from 'axios';

export default async function handler(req, res) {
  const { code, state } = req.query;

  const tokenRes = await axios.post('https://auth.truelayer.com/connect/token', new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.TL_CLIENT_ID,
    client_secret: process.env.TL_CLIENT_SECRET,
    redirect_uri: process.env.TL_REDIRECT_URI,
    code
  }));

  const { access_token, refresh_token } = tokenRes.data;

  await supabase.from('bank_tokens').upsert({
    client_id: state,
    access_token,
    refresh_token
  });

  res.redirect(`/dashboard?connected=true`);
}
