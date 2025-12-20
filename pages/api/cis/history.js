// pages/api/cis/history.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

// Build CIS monthly periods (6th → 5th) over last N years
function generateCisPeriods(yearsBack = 5) {
  const now = new Date();
  const periods = [];
  const startYear = now.getFullYear() - yearsBack;

  // We’ll iterate from oldest → newest, then reverse for newest-first
  for (let year = startYear; year <= now.getFullYear(); year++) {
    for (let month = 0; month < 12; month++) {
      const periodStart = new Date(year, month, 6);
      const periodEnd = new Date(year, month + 1, 5);

      if (periodEnd > now) continue;

      const startStr = periodStart.toISOString().slice(0, 10);
      const endStr = periodEnd.toISOString().slice(0, 10);

      periods.push({
        periodStart: startStr,
        periodEnd: endStr,
        periodLabel: `${startStr} → ${endStr}`,
      });
    }
  }

  return periods.reverse();
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );
  if (!(isFounder || isSubscribedOrTrial))
    return res.status(403).json({ error: "Upgrade required" });

  // Accountant-aware clientId resolution
  const actingClientId =
    session.user.actingAsClientId ||
    session.user.clientId ||
    session.user.defaultClientId;
  const clientId = actingClientId;
  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  try {
    // Audit: accountant viewing CIS history
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          id: crypto.randomUUID(),
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_CIS_HISTORY",
          details: "Viewed CIS history page",
          timestamp: new Date().toISOString(),
          user: null,
          user_id: null,
        },
      ]);
    }

    const now = new Date();

    // 1) Load CIS-relevant transactions (for last 5 years)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const { data: cisTx, error: cisTxError } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, amount, cis_amount, cis_type, cis_rate, tax_locked, description"
      )
      .eq("client_id", clientId)
      .gte("date", fiveYearsAgo.toISOString().slice(0, 10))
      .lte("date", now.toISOString().slice(0, 10));

    if (cisTxError) throw cisTxError;

    // 2) Generate all CIS periods (6th → 5th)
    const rawCisPeriods = generateCisPeriods(5);

    // 3) Bucket transactions into periods
    const periods = rawCisPeriods.map((p) => {
      const periodStartDate = new Date(p.periodStart);
      const periodEndDate = new Date(p.periodEnd);

      const txForPeriod = (cisTx || []).filter((tx) => {
        if (!tx.cis_type || tx.cis_amount == null) return false;
        if (!tx.date) return false;
        const d = new Date(tx.date);
        return d >= periodStartDate && d <= periodEndDate;
      });

      let cisDeducted = 0;
      let cisSuffered = 0;
      let locked = false;

      txForPeriod.forEach((tx) => {
        const amt = Math.abs(Number(tx.cis_amount || 0));
        if (tx.cis_type === "deducted") cisDeducted += amt;
        if (tx.cis_type === "suffered") cisSuffered += amt;
        if (tx.tax_locked) locked = true;
      });

      const netCis = cisDeducted - cisSuffered;
      const hasActivity =
        txForPeriod.length > 0 ||
        Math.abs(cisDeducted) > 0 ||
        Math.abs(cisSuffered) > 0 ||
        Math.abs(netCis) > 0;

      // Later we’ll overlay submissions/payments on top
      return {
        periodLabel: p.periodLabel,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        locked,
        cisDeducted,
        cisSuffered,
        netCis,
        hasActivity,
      };
    });

    // 4) CIS submissions
    const { data: cisSubmissions, error: cisSubmissionsError } =
      await supabaseAdmin
        .from("cis_submissions")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

    if (cisSubmissionsError) throw cisSubmissionsError;

    // 5) CIS payments
    const { data: cisPayments, error: cisPaymentsError } = await supabaseAdmin
      .from("cis_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    if (cisPaymentsError) throw cisPaymentsError;

    const totalCisPaid = (cisPayments || []).reduce(
      (sum, p) => sum + (p.direction === "payment" ? p.amount : -p.amount),
      0
    );

    // 6) CIS adjustments
    const { data: cisAdjustments, error: cisAdjustmentsError } =
      await supabaseAdmin
        .from("cis_adjustments")
        .select(
          "id, client_id, cis_submission_id, amount, reason, created_by, created_at"
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

    if (cisAdjustmentsError) throw cisAdjustmentsError;

    // 7) Overlay submission info onto periods
    periods.forEach((p) => {
      const submission = (cisSubmissions || []).find(
        (s) =>
          s.period_start === p.periodStart && s.period_end === p.periodEnd
      );
      if (submission) {
        p.submitted = true;
        p.submittedAt = submission.created_at;
        p.cisDeducted = submission.cis_deducted;
        p.cisSuffered = submission.cis_suffered;
        p.netCis = submission.net_cis;
      } else {
        p.submitted = false;
      }

      const endDate = new Date(p.periodEnd);
      const overdue = !p.submitted && endDate < now && p.hasActivity;
      p.overdue = overdue;
      p.status = p.submitted
        ? "Submitted"
        : overdue
        ? "Overdue"
        : p.hasActivity
        ? "Ready to Submit"
        : endDate < now && !p.hasActivity
        ? "Draft (No Activity)"
        : "Draft";
    });

    const totalCisNet = periods.reduce((sum, p) => sum + (p.netCis || 0), 0);
    const cisBalance = totalCisNet - totalCisPaid;
    const overdueCisCount = periods.filter((p) => p.overdue).length;

    // 8) Build timeline (submissions + payments + adjustments)
    const timeline = [];

    (cisSubmissions || []).forEach((s) => {
      timeline.push({
        type: "submission",
        date: s.created_at,
        periodStart: s.period_start,
        periodEnd: s.period_end,
        cisDeducted: s.cis_deducted,
        cisSuffered: s.cis_suffered,
        netCis: s.net_cis,
      });
    });

    (cisPayments || []).forEach((p) => {
      timeline.push({
        type: "payment",
        date: p.payment_date,
        amount: p.amount,
        direction: p.direction,
        reference: p.reference,
      });
    });

    (cisAdjustments || []).forEach((a) => {
      timeline.push({
        type: "adjustment",
        date: a.created_at,
        amount: a.amount,
        reason: a.reason,
        createdBy: a.created_by,
        cisSubmissionId: a.cis_submission_id,
      });
    });

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      periods,
      cisSubmissions,
      cisPayments,
      cisAdjustments,
      timeline,
      totalCisNet,
      totalCisPaid,
      cisBalance,
      overdueCisCount,
    });
  } catch (err) {
    console.error("CIS history error:", err);
    return res.status(500).json({ error: err.message });
  }
}
