import { setCookie } from "nookies";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { timingSafeEqual } from "crypto"; // ✅ Correct import

const FOUNDER_PIN = process.env.FOUNDER_PIN;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pin } = req.body || {};

  // ⭐ Constant‑time comparison to prevent timing attacks
  const safeCompare = (a: string, b: string) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) return false;

    return timingSafeEqual(bufA, bufB);
  };

  const pinValid =
    typeof FOUNDER_PIN === "string" &&
    safeCompare(String(pin), String(FOUNDER_PIN));

  if (!pinValid) {
    // ⭐ Log failed attempt (never reveal details)
    try {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: "founder",
          actor_email: "PIN_ENTRY",
          action: "FOUNDER_PIN_LOGIN_FAILED",
          details: "Invalid founder PIN attempt",
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.warn("⚠️ Failed to log failed founder PIN attempt:", err.message);
    }

    return res.status(401).json({ error: "Invalid PIN" });
  }

  // ⭐ Set founder-access cookie (strongest flags)
  setCookie({ res }, "founder-access", "true", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 15, // 15 minutes
  });

  // ⭐ Log successful founder access
  try {
    await supabaseAdmin.from("audit").insert([
      {
        client_id: "founder",
        actor_email: "PIN_ENTRY",
        action: "FOUNDER_PIN_LOGIN",
        details: "Founder access granted via PIN",
        timestamp: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.warn("⚠️ Failed to log founder access:", err.message);
  }

  // ⭐ Safe redirect
  res.writeHead(302, { Location: "/dashboard" });
  res.end();
}
