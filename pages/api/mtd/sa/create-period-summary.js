// pages/api/mtd/sa/create-period-summary.js
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

  const { periodStart, periodEnd, income, expenses } = req.body;

  if (!periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing periodStart or periodEnd" });

  // ⭐ Accountant period-range sanity check
  if (role === "ACCOUNTANT") {
    const startYear = Number(periodStart.split("-")[0]);
    const endYear = Number(periodEnd.split("-")[0]);

    if (
      Number.isNaN(startYear) ||
      Number.isNaN(endYear) ||
      startYear < 2000 ||
      endYear > 2100 ||
      endYear < startYear
    ) {
      return res.status(400).json({ error: "Invalid period range" });
    }
  }

  try {
    const mtd = await createClient(clientId);

    // ⭐ Guard: no MTD ITSA connection
    if (!mtd || !mtd.mtditid) {
      return res.status(400).json({ error: "MTD not connected" });
    }

    // ⭐ AUDIT LOG — Accountant submitting SA Period Summary
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_SUBMIT_MTD_SA_PERIOD_SUMMARY",
          details: `Submitted SA Period Summary ${periodStart} → ${periodEnd}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Build HMRC Period Summary payload
    const body = {
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      incomes: income || {},
      expenses: expenses || {}
    };

    // ⭐ Submit to HMRC
    const summary = await mtd.createSAPeriodSummary(body);

    return res.status(200).json({
      success: true,
      summary
    });

  } catch (err) {
    console.error("SA MTD create period summary error:", err);
    return res.status(500).json({ error: err.message });
  }
}
