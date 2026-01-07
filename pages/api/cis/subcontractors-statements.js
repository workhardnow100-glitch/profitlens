// pages/api/cis/subcontractor-statements.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // 🔐 Session required
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

  // 🔐 Accountant-aware clientId
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }
  if (!clientId)
    return res.status(400).json({ error: "No client selected" });

  const { periodStart, periodEnd, clientId: bodyClientId } = req.body;

  if (!periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing required fields" });

  // 🔐 Prevent accountants from spoofing clientId
  if (role === "ACCOUNTANT" && bodyClientId && bodyClientId !== clientId) {
    return res.status(403).json({
      error: "Accountants cannot request CIS statements for unauthorized clients",
    });
  }

  try {
    // 📝 Audit log — Accountant viewing CIS subcontractor statements
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_CIS_SUBCONTRACTOR_STATEMENTS",
          details: `Viewed CIS subcontractor statements for ${periodStart} → ${periodEnd}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // 1) Load CIS-relevant transactions for the period
    const { data: cisTx, error: cisError } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, amount, cis_amount, cis_type, cis_rate, tax_locked, description"
      )
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .not("cis_type", "is", null)
      .not("cis_amount", "is", null)
      .order("date", { ascending: true });

    if (cisError) throw cisError;

    // 2) Build statement-ready rows (no hard assumption on subcontractor field yet)
    // UI can group by description or future subcontractor field.
    const rows = (cisTx || []).map((tx) => {
      const gross = Number(tx.amount || 0);
      const cis = Number(tx.cis_amount || 0);
      const cisType = tx.cis_type; // "deducted" or "suffered"

      return {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        gross,
        cisAmount: cis,
        cisType,
        cisRate: tx.cis_rate,
        taxLocked: tx.tax_locked,
      };
    });

    // 3) Totals by cis_type
    let cisDeducted = 0;
    let cisSuffered = 0;

    rows.forEach((r) => {
      if (r.cisType === "deducted") cisDeducted += Math.abs(r.cisAmount);
      if (r.cisType === "suffered") cisSuffered += Math.abs(r.cisAmount);
    });

    const netCis = cisDeducted - cisSuffered;

    return res.status(200).json({
      periodStart,
      periodEnd,
      cisDeducted,
      cisSuffered,
      netCis,
      rows,
    });
  } catch (err) {
    console.error("CIS subcontractor statements error:", err);
    return res.status(500).json({ error: err.message });
  }
}
