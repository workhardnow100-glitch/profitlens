// pages/api/mtd/sa/get-receipt.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { createClient } from "../../../../lib/mtd-client";

export default async function handler(req, res) {
  if (req.method !== "POST")
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

  // ⭐ Determine clientId (accountant‑aware)
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId)
    return res.status(400).json({ error: "No client selected" });

  const { submissionId } = req.body;

  if (!submissionId)
    return res.status(400).json({ error: "Missing submissionId" });

  try {
    const mtd = await createClient(clientId);

    // ⭐ Guard: no MTD ITSA connection
    if (!mtd || !mtd.mtditid) {
      return res.status(400).json({ error: "MTD not connected" });
    }

    // ⭐ AUDIT LOG — Accountant viewing SA MTD receipt
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_MTD_SA_RECEIPT",
          details: `Viewed SA MTD receipt for submissionId ${submissionId}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ HMRC does not provide a dedicated SA receipt endpoint.
    // We fetch SA returns and extract the matching submission.
    const returnsData = await mtd.getSAReturns();

    const match = returnsData?.returns?.find(
      (r) => r.submissionId === submissionId
    );

    if (!match) {
      return res.status(404).json({
        error: "Receipt not found for this submissionId",
      });
    }

    return res.status(200).json({
      success: true,
      receipt: match,
    });

  } catch (err) {
    console.error("SA MTD get receipt error:", err);
    return res.status(500).json({ error: err.message });
  }
}
