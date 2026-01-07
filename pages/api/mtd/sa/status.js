// pages/api/mtd/sa/status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { createClient } from "../../../../lib/mtd-client";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  // ⭐ Validate session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();

  // ⭐ Subscription gating
  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Resolve clientId (accountant‑aware)
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId)
    return res.status(400).json({ error: "No client selected" });

  try {
    const mtd = await createClient(clientId);

    // ⭐ Guard: no MTD connection
    const connected = !!mtd?.mtditid;

    // ⭐ AUDIT LOG — Accountant viewing SA MTD status
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_MTD_SA_STATUS",
          details: `Viewed SA MTD connection status: ${connected ? "connected" : "not connected"}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    return res.status(200).json({
      success: true,
      connected,
    });

  } catch (err) {
    console.error("SA MTD status error:", err);
    return res.status(500).json({ error: err.message });
  }
}
