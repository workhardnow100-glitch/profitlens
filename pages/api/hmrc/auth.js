export default function handler(req, res) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.HMRC_CLIENT_ID,
    scope: "read:vat write:vat",
    redirect_uri: process.env.HMRC_REDIRECT_URI,
  });

  res.redirect(`https://api.service.hmrc.gov.uk/oauth/authorize?${params}`);
}
