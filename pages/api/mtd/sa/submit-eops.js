// pages/api/mtd/sa/submit-eops.js
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

  const { taxYear, incomeSourceType } = req.body;

  if (!taxYear || !incomeSourceType)
    return res.status(400).json({ error: "Missing taxYear or incomeSourceType" });

  // ⭐ Accountant sanity checks
  if (role === "ACCOUNTANT") {
    const yearNum = Number(taxYear);
    if (Number.isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({ error: "Invalid taxYear" });
    }

    const allowedTypes = ["self-employment", "uk-property", "foreign-property"];
    if (!allowedTypes.includes(incomeSourceType)) {
      return res.status(400).json({ error: "Invalid incomeSourceType" });
    }
  }

  try {
    const mtd = await createClient(clientId);

    // ⭐ Guard: no MTD ITSA connection
    if (!mtd || !mtd.mtditid) {
      return res.status(400).json({ error: "MTD not connected" });
    }

    // ⭐ AUDIT LOG — Accountant submitting EOPS
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_SUBMIT_MTD_SA_EOPS",
          details: `Submitted EOPS for taxYear ${taxYear}, incomeSourceType ${incomeSourceType}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Build HMRC EOPS payload
    const body = {
      taxYear,
      incomeSourceType
    };

    // ⭐ Submit EOPS to HMRC
    const response = await mtd.submitEOPS(body);

    return res.status(200).json({
      success: true,
      response
    });

  } catch (err) {
    console.error("SA MTD submit EOPS error:", err);
    return res.status(500).json({ error: err.message });
  }
}
