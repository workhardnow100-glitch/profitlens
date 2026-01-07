// pages/api/sa/submit.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ✅ Validate session
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

  // ⭐ Accountant-aware client ID (strict)
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId)
    return res.status(400).json({ error: "No client selected" });

  const { periodStart, periodEnd } = req.body;

  if (!periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing required fields" });

  // ⭐ Extra guard: prevent absurd ranges for accountants
  if (role === "ACCOUNTANT") {
    const startYear = Number(String(periodStart).split("-")[0]);
    const endYear = Number(String(periodEnd).split("-")[0]);

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
    // ⭐ AUDIT LOG — Accountant submitting SA
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_SUBMIT_SA",
          details: `Submitted SA for ${periodStart} → ${periodEnd}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Lock SA transactions (correct field: business_category)
    const { error: lockError } = await supabaseAdmin
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .eq("business_category", "self_assessment")
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (lockError) throw lockError;

    // ⭐ Create submission record
    const { data: submission, error: subError } = await supabaseAdmin
      .from("sa_submissions")
      .insert([
        {
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (subError) throw subError;

    return res.status(200).json({ success: true, submission });

  } catch (err) {
    console.error("SA submit error:", err);
    return res.status(500).json({ error: err.message });
  }
}
