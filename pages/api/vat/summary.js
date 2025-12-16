// pages/api/vat/summary.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Global, bank-agnostic code hints
const EXPENSE_TYPE_HINTS = [
  // Generic/bank codes
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

// Codes that usually represent internal transfers / non-VATable flows
const TRANSFER_TYPE_HINTS = [
  "TFR", "TRANSFER", "TFR IN", "TFR OUT",
];

function classifyTransactionType(rawType, amount) {
  const type = (rawType || "").toUpperCase().trim();
  const gross = Number(amount || 0);

  // 1️⃣ Transfer / neutral → ignore for VAT
  if (TRANSFER_TYPE_HINTS.includes(type)) return "transfer";

  // 2️⃣ Bank code hints
  if (INCOME_TYPE_HINTS.includes(type)) return "income";
  if (EXPENSE_TYPE_HINTS.includes(type)) return "expense";

  // 3️⃣ Universal fallback: sign of amount
  if (gross > 0) return "income";
  if (gross < 0) return "expense";

  // 4️⃣ Unknown / zero → ignore
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    // 1️⃣ Optional: VAT period record (lock + submitted status)
    const { data: vatPeriod } = await supabase
      .from("vat_periods")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    const vatPeriodId = vatPeriod?.id ?? null;
    const locked = !!vatPeriod?.locked;
    const submitted = !!vatPeriod?.submitted;

    // 2️⃣ Fetch VAT-relevant transactions
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select(
        "id, date, description, amount, type, category, vat_rate, vat_amount, hmrc_category_id, tax_locked"
      )
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      // VAT-relevant: has a rate or a non-zero VAT amount
      .or("vat_rate.not.is.null,vat_amount.not.eq.0");

    if (txError) throw txError;

    const vatTransactions = transactions || [];

    // 3️⃣ Determine locked state
    const isLockedByTx =
      vatTransactions.length > 0 &&
      vatTransactions.every((tx) => tx.tax_locked === true);

    const effectiveLocked = locked || isLockedByTx;

    // 4️⃣ VAT box totals
    let box1 = 0; // VAT due on sales and other outputs
    let box2 = 0; // VAT due on acquisitions (unused for now)
    let box4 = 0; // VAT reclaimed on purchases and other inputs
    let box6 = 0; // Total value of sales and all other outputs (net)
    let box7 = 0; // Total value of purchases and all other inputs (net)
    let box8 = 0; // EU supplies (unused for now)
    let box9 = 0; // EU acquisitions (unused for now)

    for (const tx of vatTransactions) {
      const gross = Number(tx.amount || 0);   // may be negative
      const vat = Number(tx.vat_amount || 0); // may be negative
      const net = gross - vat;

      const classification = classifyTransactionType(tx.type, gross);

      // Ignore transfers / unknowns for VAT
      if (!classification || classification === "transfer") continue;

      // For VAT boxes, we want positive values
      const netAbs = Math.abs(net);
      const vatAbs = Math.abs(vat);

      if (classification === "income") {
        // Sales / outputs
        box6 += netAbs;
        if (vatAbs > 0) box1 += vatAbs;
      }

      if (classification === "expense") {
        // Purchases / inputs
        box7 += netAbs;
        if (vatAbs > 0) box4 += vatAbs;
      }
    }

    let box3 = box1 + box2;
    let box5 = box3 - box4;

    // 5️⃣ Load VAT adjustments
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

    // 6️⃣ Apply adjustments
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
        default:
          break;
      }
    }

    // 7️⃣ Recalculate dependent boxes
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
