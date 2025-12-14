import { supabaseAdmin } from "../../../lib/supabase-admin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).end();

  if (req.cookies.hmrc_state !== req.query.state) {
    return res.status(400).send("Invalid OAuth state");
  }

  const tokenRes = await fetch("https://api.service.hmrc.gov.uk/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HMRC_CLIENT_ID,
      client_secret: process.env.HMRC_CLIENT_SECRET,
      redirect_uri: process.env.HMRC_REDIRECT_URI,
      code: req.query.code,
    }),
  });

  if (!tokenRes.ok) {
    return res.status(500).send("Token exchange failed");
  }

  const tokens = await tokenRes.json();

  await supabaseAdmin.from("hmrc_tokens").upsert({
    user_id: session.user.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  });

  res.redirect("/mtd-dashboard");
}

