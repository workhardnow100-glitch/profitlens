// pages/api/vat/summary.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // adjust path if needed
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔐 Internal server-to-server bypass: set in Vercel env
// INTERNAL_SECRET=some-long-random-string

// ✅ Global, bank-agnostic code hints
const EXPENSE_TYPE_HINTS = [
  "DEB", "DR", "DB", "D",
  "PAY", "POS", "CARD", "CPT",
  "DD", "SO", "ATM", "CHG", "FEE",
  "PUR", "WITHDRAWAL",
];

const INCOME_TYPE_HINTS = [
  "CR", "CRD", "C",
  "BGC", "FPI", "FPS",
  "DEP", "REV", "REFUND",
  "SAL", "INT",
];

const TRANSFER_TYPE_HINTS = [
  "TFR", "TRANSFER", "TFR IN", "TFR OUT",
];

function classifyTransactionType(rawType, amount) {
  const type = (rawType || "").toUpperCase().trim();
  const gross = Number(amount || 0);

  if (TRANSFER_TYPE_HINTS.includes(type)) return "transfer";
  if (INCOME_TYPE_HINTS.includes(type)) return "income";
  if (EXPENSE_TYPE_HINTS.includes(type)) return "expense";

  if (gross > 0) return "income";
  if (gross < 0) return "expense";

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // 🔑 Detect internal server-to-server call
  const internalBypass =
    req.headers["x-internal-secret"] &&
    process.env.INTERNAL_SECRET &&
    req.headers["x-internal-secret"] === process.env.INTERNAL_SECRET;

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

  // ✅ Accountant-aware client ID (only relevant for external requests)
  const actingClientId =
    session?.user?.actingAsClientId || session?.user?.clientId;

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  // ✅ Prevent accountants from spoofing clientId (external only)
  if (!internalBypass && session.user.role === "accountant" && clientId !== actingClientId) {
    return res.status(403).json({
      error: "Accountants cannot view VAT summaries for unauthorized clients",
    });
  }

  try {
    // ✅ AUDIT LOG — Accountant viewing VAT summary (external only)
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

    // ✅ 1. VAT period record (lock + submitted status)
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

    // ✅ 2. Fetch VAT-relevant transactions
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select(
        "id, date, description, amount, type, business_category, vat_rate, vat_amount, tax_locked"
      )
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .or("vat_rate.not.is.null,vat_amount.not.eq.0");

    if (txError) throw txError;

    const vatTransactions = transactions || [];

    // ✅ 3. Determine locked state
    const isLockedByTx =
      vatTransactions.length > 0 &&
      vatTransactions.every((tx) => tx.tax_locked === true);

    const effectiveLocked = locked || isLockedByTx;

    // ✅ 4. VAT box totals
    let box1 = 0;
    let box2 = 0;
    let box4 = 0;
    let box6 = 0;
    let box7 = 0;
    let box8 = 0;
    let box9 = 0;

    for (const tx of vatTransactions) {
      const gross = Number(tx.amount || 0);
      const vat = Number(tx.vat_amount || 0);
      const net = gross - vat;

      const classification = classifyTransactionType(tx.type, gross);
      if (!classification || classification === "transfer") continue;

      const netAbs = Math.abs(net);
      const vatAbs = Math.abs(vat);

      if (classification === "income") {
        box6 += netAbs;
        if (vatAbs > 0) box1 += vatAbs;
      }

      if (classification === "expense") {
        box7 += netAbs;
        if (vatAbs > 0) box4 += vatAbs;
      }
    }

    let box3 = box1 + box2;
    let box5 = box3 - box4;

    // ✅ 5. Load VAT adjustments
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

    // ✅ 6. Apply adjustments
    for (const adj of adjustments) {
      const amt = Number(adj.amount || 0);
      switch (adj.box) {
        case 1: box1 += amt; break;
        case 2: box2 += amt; break;
        case 3: box3 += amt; break;
        case 4: box4 += amt; break;
        case 5: box5 += amt; break;
        case 6: box6 += amt; break;
        case 7: box7 += amt; break;
        case 8: box8 += amt; break;
        case 9: box9 += amt; break;
      }
    }

    // ✅ 7. Recalculate dependent boxes
    box3 = box1 + box2;
    box5 = box3 - box4;

    return res.status(200).json({
      period: `${periodStart} → ${periodEnd}`,
      locked: effectiveLocked,
      submitted,
      vatPeriodId,
      status: submitted ? "filed" : "draft",
      boxes: {
        box1: Number(box1.toFixed(2)),
        box2: Number(box2.toFixed(2)),
        box3: Number(box3.toFixed(2)),
        box4: Number(box4.toFixed(2)),
        box5: Number(box5.toFixed(2)),
        box6: Number(box6.toFixed(2)),
        box7: Number(box7.toFixed(2)),
        box8: Number(box8.toFixed(2)),
        box9: Number(box9.toFixed(2)),
      },
      transactions: vatTransactions,
      adjustments,
    });
  } catch (err) {
    console.error("VAT summary error:", err);
    return res.status(500).json({ error: err.message });
  }
}
