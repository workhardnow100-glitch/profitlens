// pages/api/cis/export-return.js
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
      error: "Accountants cannot export CIS returns for unauthorized clients",
    });
  }

  try {
    // 📝 Audit log — Accountant exporting CIS return
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_EXPORT_CIS_RETURN",
          details: `Exported CIS return for ${periodStart} → ${periodEnd}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // 1) Load CIS-relevant transactions
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

    // 2) Compute totals
    let cisDeducted = 0;
    let cisSuffered = 0;

    (cisTx || []).forEach((tx) => {
      const amt = Math.abs(Number(tx.cis_amount || 0));
      if (tx.cis_type === "deducted") cisDeducted += amt;
      if (tx.cis_type === "suffered") cisSuffered += amt;
    });

    const netCis = cisDeducted - cisSuffered;

    // 3) Load CIS submission (if exists)
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from("cis_submissions")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (submissionError) throw submissionError;

    const exportedAt = new Date().toISOString();

    return res.status(200).json({
      clientId,
      periodStart,
      periodEnd,
      exportedAt,
      totals: {
        cisDeducted,
        cisSuffered,
        netCis,
      },
      submission: submission || null,
      transactions: cisTx || [],
    });
  } catch (err) {
    console.error("CIS export return error:", err);
    return res.status(500).json({ error: err.message });
  }
}
