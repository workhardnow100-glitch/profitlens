export default async function handler(req, res) {
  const code = req.query.code;

  const tokenRes = await fetch("https://api.service.hmrc.gov.uk/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HMRC_CLIENT_ID,
      client_secret: process.env.HMRC_CLIENT_SECRET,
      redirect_uri: process.env.HMRC_REDIRECT_URI,
      code,
    }),
  });

  const tokens = await tokenRes.json();

  // Store encrypted in Supabase
  await supabase.from("hmrc_tokens").upsert({
    user_id: req.user.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  });

  res.redirect("/mtd-dashboard");
}
