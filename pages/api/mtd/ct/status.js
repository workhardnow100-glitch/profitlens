// pages/api/mtd/ct/status.js
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

  // ⭐ Subscription gating (required for all MTD endpoints)
  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant‑aware client ID
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
    if (!mtd) {
      return res.status(400).json({ error: "MTD not connected" });
    }

    // ⭐ AUDIT LOG — Accountant viewing CT MTD status
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_MTD_CT_STATUS",
          details: "Viewed CT MTD connection status",
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Fetch CT MTD connection status
    const status = await mtd.getCTConnectionStatus();

    return res.status(200).json({
      success: true,
      status
    });

  } catch (err) {
    console.error("CT MTD status error:", err);
    return res.status(500).json({ error: err.message });
  }
}
