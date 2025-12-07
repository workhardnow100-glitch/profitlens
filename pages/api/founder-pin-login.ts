// pages/api/founder_pin_login.js
import { setCookie } from "nookies";
import { supabaseAdmin } from "../../lib/supabase-admin";

const FOUNDER_PIN = process.env.FOUNDER_PIN; // ✅ move to env

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pin } = req.body;

  if (!FOUNDER_PIN || pin !== FOUNDER_PIN) {
    return res.status(401).json({ error: "Invalid PIN" });
  }

  // ✅ Set founder-access cookie
  setCookie({ res }, "founder-access", "true", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 15, // 15 minutes
  });

  // ✅ Log audit event
  try {
    await supabaseAdmin.from("audit_logs").insert([
      {
        action: "FOUNDER_PIN_LOGIN",
        actor: "PIN_ENTRY",
        context: "api/founder_pin_login",
        timestamp: new Date().toISOString(),
        details: "Founder access granted via PIN",
        client_id: "founder", // optional: scope to a special client
      },
    ]);
  } catch (err) {
    console.warn("⚠️ Failed to log founder access:", err.message);
  }

  res.writeHead(302, { Location: "/dashboard" });
  res.end();
}
