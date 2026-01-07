// pages/api/vat/set-stagger.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // 🔐 SESSION REQUIRED
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // 🔐 Accountant-aware client ID
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  const { clientId: bodyClientId, stagger } = req.body;

  // 🔐 Prevent accountants from spoofing clientId
  if (role === "ACCOUNTANT" && bodyClientId && bodyClientId !== clientId) {
    return res.status(403).json({
      error: "Accountants cannot change VAT settings for unauthorized clients",
    });
  }

  if (![1, 2, 3].includes(Number(stagger))) {
    return res.status(400).json({ error: "Invalid stagger value" });
  }

  try {
    // 📝 AUDIT LOG — Accountant changing VAT stagger
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_SET_VAT_STAGGER",
          details: `Set VAT stagger to ${stagger}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // 🔧 Update VAT stagger
    const { error } = await supabaseAdmin
      .from("vat_settings")
      .upsert({
        client_id: clientId,
        stagger: Number(stagger),
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("VAT stagger update error:", err);
    return res.status(500).json({ error: err.message });
  }
}
