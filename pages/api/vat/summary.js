// pages/api/vat/summary.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔐 Internal server-to-server bypass: set in Vercel env
// INTERNAL_SECRET=some-long-random-string

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // 🔑 Detect internal server-to-server call
  const internalBypass =
    req.headers["x-internal-secret"] &&
    process.env.INTERNAL_SECRET &&
    req.headers["x-internal-secret"] === process.env.INTERNAL_SECRET;

  console.log("VAT summary bypass debug:", {
    header: req.headers["x-internal-secret"],
    env: process.env.INTERNAL_SECRET,
    match: req.headers["x-internal-secret"] === process.env.INTERNAL_SECRET,
  });

  // ✅ Validate session for external calls only
  let session = null;
  if (!internalBypass) {
    session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

    const isFounder = session.user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      session.user.subscriptionStatus
    );
    if (!(isFounder || isSubscribedOrTrial)) {
      return res.status(403).json({ error: "Upgrade required" });
    }
  }

  const actingClientId =
    session?.user?.actingAsClientId || session?.user?.clientId;
  const { clientId, periodStart, periodEnd } = req.body;
  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  if (
    !internalBypass &&
    session.user.role === "accountant" &&
    clientId !== actingClientId
  ) {
    return res
      .status(403)
      .json({
        error:
          "Accountants cannot view VAT summaries for unauthorized clients",
      });
  }

  try {
    // Audit
    if (!internalBypass && session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_VAT_SUMMARY",
          details: `Viewed VAT summary for ${periodStart} → ${periodEnd}`,
        },
      ]);
    }

    // VAT period record (lock/submitted + adjustments linkage)
    const { data: vatPeriod, error: vatPeriodErr } = await supabase
      .from("vat_periods")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();
    if (vatPeriodErr) throw vatPeriodErr;

    const vatPeriodId = vatPeriod?.id ?? null;
    const locked = !!vatPeriod?.locked;
    const submitted = !!vatPeriod?.submitted;

    // 🔹 Fetch transactions with VAT + COA + VAT toggle
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select(
        `
        id,
        date,
        description,
        amount,
        type,
        business_category,
        vat_rate,
        vat_amount,
        tax_locked,
        coa_id,
        includedinvat
      `
      )
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .or("vat_rate.not.is.null,vat_amount.not.eq.0");
    if (txError) throw txError;

    const vatTransactions = transactions || [];
    const isLockedByTx =
      vatTransactions.length > 0 &&
      vatTransactions.every((tx) => tx.tax_locked === true);
    const effectiveLocked = locked || isLockedByTx;

    // 🔹 Load COA entries for VAT classification
    const distinctCoaIds = Array.from(
      new Set(vatTransactions.map((tx) => tx.coa_id).filter(Boolean))
    );

    let coaMap = new Map();
    if (distinctCoaIds.length > 0) {
      const { data: coaRows, error: coaError } = await supabaseAdmin
        .from("chart_of_account_entries")
        .select(
          "id, account_type, hmrc_bucket, is_control_account, is_bank_account"
        )
        .in("id", distinctCoaIds);

      if (coaError) throw coaError;
      (coaRows || []).forEach((row) => {
        coaMap.set(row.id, row);
      });
    }

    // 🔹 VAT box calculations (COA-driven, toggle-driven)
    let box1 = 0,
      box2 = 0,
      box4 = 0,
      box6 = 0,
      box7 = 0,
      box8 = 0,
      box9 = 0;

    for (const tx of vatTransactions) {
      const gross = Number(tx.amount || 0);
      const vat = Number(tx.vat_amount || 0);
      const net = gross - vat;

      // Respect VAT toggle if present: only include when explicitly on
      if (tx.includedinvat === false) continue;

      // Require non-zero VAT or explicit vat_rate
      if (!vat && !tx.vat_rate) continue;

      const coa = coaMap.get(tx.coa_id);
      if (!coa) continue;

      const bucket = coa.hmrc_bucket;
      const type = coa.account_type;

      const isControl =
        bucket === "control" ||
        bucket === "system" ||
        bucket === "balance_sheet" ||
        bucket === "equity" ||
        bucket === "liabilities" ||
        bucket === "assets" ||
        coa.is_control_account ||
        coa.is_bank_account;

      if (isControl) continue;

      const netAbs = Math.abs(net);
      const vatAbs = Math.abs(vat);

      // INCOME accounts → output VAT (Box 1 + Box 6)
      if (type === "INCOME") {
        if (netAbs > 0) box6 += netAbs;
        if (vatAbs > 0) box1 += vatAbs;
      }

      // EXPENSE accounts → input VAT (Box 4 + Box 7)
      if (type === "EXPENSE") {
        if (netAbs > 0) box7 += netAbs;
        if (vatAbs > 0) box4 += vatAbs;
      }

      // (Box 2, 8, 9 left at 0 for now – EU/acquisitions not implemented)
    }

    let box3 = box1 + box2;
    let box5 = box3 - box4;

    // 🔹 Adjustments
    let adjustments = [];
    if (vatPeriodId) {
      const { data: adjData, error: adjError } = await supabase
        .from("vat_adjustments")
        .select("*")
        .eq("client_id", clientId)
        .eq("vat_period_id", vatPeriodId);
      if (adjError) throw adjError;
      adjustments = adjData || [];
    } else {
      const { data: adjData, error: adjError } = await supabase
        .from("vat_adjustments")
        .select("*")
        .eq("client_id", clientId)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd);
      if (adjError) throw adjError;
      adjustments = adjData || [];
    }

    for (const adj of adjustments) {
      const amt = Number(adj.amount || 0);
      switch (adj.box) {
        case 1:
          box1 += amt;
          break;
        case 2:
          box2 += amt;
          break;
        case 3:
          box3 += amt;
          break;
        case 4:
          box4 += amt;
          break;
        case 5:
          box5 += amt;
          break;
        case 6:
          box6 += amt;
          break;
        case 7:
          box7 += amt;
          break;
        case 8:
          box8 += amt;
          break;
        case 9:
          box9 += amt;
          break;
      }
    }
    box3 = box1 + box2;
    box5 = box3 - box4;

    // 🔹 Client details for PDF
    const { data: clientDetails, error: clientErr } = await supabase
      .from("clients")
      .select(
        "id, name, email, phone, address, postcode, business_name, company_number, vat_number"
      )
      .eq("id", clientId)
      .single();

    if (clientErr) throw clientErr;

    return res.status(200).json({
      period: `${periodStart} → ${periodEnd}`,
      locked: effectiveLocked,
      submitted,
      vatPeriodId,
      status: submitted ? "filed" : "draft",
      boxes: {
        box1: +box1.toFixed(2),
        box2: +box2.toFixed(2),
        box3: +box3.toFixed(2),
        box4: +box4.toFixed(2),
        box5: +box5.toFixed(2),
        box6: +box6.toFixed(2),
        box7: +box7.toFixed(2),
        box8: +box8.toFixed(2),
        box9: +box9.toFixed(2),
      },
      transactions: vatTransactions,
      adjustments,
      clientDetails,
    });
  } catch (err) {
    console.error("VAT summary error:", err);
    return res.status(500).json({ error: err.message });
  }
}
