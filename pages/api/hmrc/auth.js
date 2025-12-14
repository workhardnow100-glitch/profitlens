// pages/api/hmrc/auth.js
export default function handler(req, res) {
  const clientId = process.env.HMRC_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.HMRC_REDIRECT_URI);

  const url = `https://test-api.service.hmrc.gov.uk/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=write:vat read:vat`;

  res.redirect(url);
}
