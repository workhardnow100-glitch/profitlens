import crypto from "crypto";

export default function handler(req, res) {
  const state = crypto.randomUUID();

  res.setHeader(
    "Set-Cookie",
    `hmrc_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/`
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.HMRC_CLIENT_ID,
    scope: "read:vat write:vat",
    redirect_uri: process.env.HMRC_REDIRECT_URI,
    state,
  });

  res.redirect(`https://api.service.hmrc.gov.uk/oauth/authorize?${params}`);
}
