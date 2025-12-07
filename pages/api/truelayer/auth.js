// /pages/api/truelayer/auth.js
export default async function handler(req, res) {
  const authUrl = `https://auth.truelayer.com/?response_type=code&client_id=${process.env.TL_CLIENT_ID}&redirect_uri=${process.env.TL_REDIRECT_URI}&scope=info accounts transactions&state=${req.query.client_id}&nonce=${Date.now()}`;
  res.redirect(authUrl);
}
