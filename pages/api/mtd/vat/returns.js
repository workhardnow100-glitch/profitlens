// pages/api/mtd/vat/returns.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { createClient } from "../../../../lib/mtd-client";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ⭐ Session required
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();
  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial))
    return res.status(403).json({ error: "Upgrade required" });

  // ⭐ Resolve clientId safely
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId)
    return res.status(400).json({ error: "No client selected" });

  try {
    // ⭐ Audit log
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_MTD_VAT_RETURNS",
          details: "Viewed HMRC VAT returns",
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Create HMRC client
    const mtd = await createClient(clientId);

    // ⭐ Guard: no MTD connection
    if (!mtd) {
      return res.status(400).json({ error: "MTD not connected" });
    }

    // ⭐ Fetch VAT returns from HMRC
    const returns = await mtd.getVATReturns();

    return res.status(200).json({
      success: true,
      returns, // RAW HMRC DATA
    });
  } catch (err) {
    console.error("MTD VAT returns error:", err);
    return res.status(500).json({ error: err.message });
  }
}
