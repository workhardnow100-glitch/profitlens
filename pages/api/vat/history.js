// pages/api/vat/history.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import vatSummaryHandler from "../vat/summary";

// Helper: format date → YYYY-MM-DD
function fmt(d) {
  return d.toISOString().split("T")[0];
}

// Helper: label like "16 Sep 2024 → 16 Dec 2024"
function label(start, end) {
  return `${new Date(start).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} → ${new Date(end).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

// Generate VAT periods based on stagger (16th → 15th, HMRC style)
function generateVatPeriods(stagger, yearsBack = 5) {
  const now = new Date();
  const periods = [];
  const staggerMonths = { 1: [0, 3, 6, 9], 2: [1, 4, 7, 10], 3: [2, 5, 8, 11] }[stagger];

  for (let y = now.getFullYear() - yearsBack; y <= now.getFullYear(); y++) {
    for (const m of staggerMonths) {
      const start = new Date(y, m, 16);
      const end = new Date(y, m + 3, 15);
      if (end <= now) {
        const startStr = fmt(start);
        const endStr = fmt(end);
        periods.push({
          periodStart: startStr,
          periodEnd: endStr,
          periodLabel: label(startStr, endStr),
        });
      }
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
    session.user.actingAsClientId || session.user.clientId || session.user.defaultClientId;
  const clientId = actingClientId;
  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  try {
    // Audit: accountant viewing VAT history
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          id: crypto.randomUUID(),
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_VAT_HISTORY",
          details: "Viewed VAT history page",
          timestamp: new Date().toISOString(),
          user: null,
          user_id: null,
        },
      ]);
    }

    const now = new Date();

    // Get VAT stagger (default 1)
    const { data: vatSetting } = await supabaseAdmin
      .from("vat_settings")
      .select("stagger")
      .eq("client_id", clientId)
      .maybeSingle();

    const stagger = vatSetting?.stagger || 1;
    const rawVatPeriods = generateVatPeriods(stagger);

    // Build periods via VAT summary handler (same as Tax Hub)
    let totalVatOwed = 0;
    let totalVatOutput = 0;
    let totalVatInput = 0;
    const periods = [];

    for (const p of rawVatPeriods) {
      const mockReq = {
        method: "POST",
        headers: { "x-internal-secret": process.env.INTERNAL_SECRET },
        body: {
          clientId,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
        },
      };

      let summary;
      await vatSummaryHandler(mockReq, {
        status: () => ({
          json: (obj) => {
            summary = obj;
            return obj;
          },
        }),
      });

      const box1 = summary?.boxes?.box1 || 0;
      const box4 = summary?.boxes?.box4 || 0;
      const box5 = summary?.boxes?.box5 || 0;
      const locked = summary?.locked || false;
      const submitted = summary?.submitted || false;

      totalVatOwed += box5;
      totalVatOutput += box1;
      totalVatInput += box4;

      const endDate = new Date(p.periodEnd);
      const hasActivity =
        Math.abs(box1) > 0 ||
        Math.abs(box4) > 0 ||
        Math.abs(box5) !== 0 ||
        submitted;

      let status = "Draft";
      if (submitted) status = "Submitted";
      else if (endDate < now && hasActivity) status = "Overdue";
      else if (hasActivity) status = "Ready to Submit";
      else if (endDate < now && !hasActivity) status = "Draft (No Activity)";

      const overdue = !submitted && endDate < now && hasActivity;

      periods.push({
        periodLabel: p.periodLabel,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        locked,
        submitted,
        outputVat: box1,
        inputVat: box4,
        netVat: box5,
        status,
        overdue,
        hasActivity,
      });
    }

    // VAT payments
    const { data: vatPayments, error: vatPaymentsError } = await supabaseAdmin
      .from("vat_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });
    if (vatPaymentsError) throw vatPaymentsError;

    const totalVatPaid = (vatPayments || []).reduce(
      (sum, p) => sum + (p.direction === "payment" ? p.amount : -p.amount),
      0
    );
    const vatBalance = totalVatOwed - totalVatPaid;

    // VAT submissions
    const { data: vatSubmissions, error: vatSubmissionsError } = await supabaseAdmin
      .from("vat_submissions")
      .select("*")
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false });
    if (vatSubmissionsError) throw vatSubmissionsError;

    // VAT adjustments
    const { data: vatAdjustments, error: vatAdjustmentsError } = await supabaseAdmin
      .from("vat_adjustments")
      .select(
        "id, client_id, vat_period_id, box, amount, reason, created_by, created_at"
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (vatAdjustmentsError) throw vatAdjustmentsError;

    // MTD submissions (VAT)
    const { data: mtdSubmissions, error: mtdError } = await supabaseAdmin
      .from("mtd_submissions")
      .select("*")
      .eq("client_id", clientId)
      .eq("category", "vat")
      .order("submitted_at", { ascending: false });
    if (mtdError) throw mtdError;

    const overdueVatCount = periods.filter((p) => p.overdue).length;

    // Combined timeline (submissions, payments, adjustments, MTD)
    const timeline = [];

    (vatSubmissions || []).forEach((s) => {
      timeline.push({
        type: "submission",
        date: s.submitted_at || s.created_at,
        periodStart: s.period_start,
        periodEnd: s.period_end,
        netVat: s.net_vat,
        hmrcStatus: s.hmrc_status,
        hmrcSubmissionId: s.hmrc_submission_id,
        box1: s.box1,
        box2: s.box2,
        box3: s.box3,
        box4: s.box4,
        box5: s.box5,
        box6: s.box6,
        box7: s.box7,
        box8: s.box8,
        box9: s.box9,
      });
    });

    (vatPayments || []).forEach((p) => {
      timeline.push({
        type: "payment",
        date: p.payment_date,
        amount: p.amount,
        direction: p.direction,
        reference: p.reference,
      });
    });

    (vatAdjustments || []).forEach((a) => {
      timeline.push({
        type: "adjustment",
        date: a.created_at,
        box: a.box,
        amount: a.amount,
        reason: a.reason,
        createdBy: a.created_by,
      });
    });

    (mtdSubmissions || []).forEach((m) => {
      timeline.push({
        type: "mtd",
        date: m.submitted_at,
        hmrcReference: m.hmrc_reference,
        receiptUrl: m.receipt_url,
        status: m.status,
        period: m.period,
      });
    });

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      periods,
      vatSubmissions,
      vatPayments,
      vatAdjustments,
      mtdSubmissions,
      timeline,
      totalVatOwed,
      totalVatPaid,
      vatBalance,
      totalVatOutput,
      totalVatInput,
      overdueVatCount,
    });
  } catch (err) {
    console.error("VAT history error:", err);
    return res.status(500).json({ error: err.message });
  }
}
