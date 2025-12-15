// pages/api/vat/summary.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    // 1️⃣ Optional: load VAT period record (lock + submitted)
    const { data: vatPeriod, error: periodError } = await supabase
      .from("vat_periods")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (periodError && periodError.code !== "PGRST116") {
      throw periodError;
    }

    const vatPeriodId = vatPeriod?.id ?? null;
    const locked = !!vatPeriod?.locked;
    const submitted = !!vatPeriod?.submitted;

    // 2️⃣ Fetch VAT-relevant transactions for client + date range
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

    if (txError) {
      throw txError;
    }

    const vatTransactions = transactions || [];

    // 3️⃣ Determine if all VAT transactions in this period are locked
    const isLockedByTx =
      vatTransactions.length > 0 &&
      vatTransactions.every((tx) => tx.tax_locked === true);

    const effectiveLocked = locked || isLockedByTx;

    // 4️⃣ Calculate VAT boxes from transactions
    let box1 = 0; // VAT due on sales
    let box2 = 0; // VAT due on acquisitions (kept 0 for now)
    let box4 = 0; // VAT reclaimed on purchases
    let box6 = 0; // Total sales (net)
    let box7 = 0; // Total purchases (net)
    let box8 = 0; // EU supplies (0 for now)
    let box9 = 0; // EU acquisitions (0 for now)

    for (const tx of vatTransactions) {
      const gross = Number(tx.amount || 0);
      const vat = Number(tx.vat_amount || 0);
      const net = gross - vat;
      const type = tx.type; // "income" or "expense"

      if (!type) continue;

      if (type === "income") {
        // Sales
        box6 += net;
        if (vat > 0) {
          box1 += vat;
        }
      } else if (type === "expense") {
        // Purchases
        box7 += net;
        if (vat > 0) {
          box4 += vat;
        }
      }
    }

    let box3 = box1 + box2;
    let box5 = box3 - box4;

    // 5️⃣ Load VAT adjustments for this client + period (by vat_period_id if available, else by date range)
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

    // 6️⃣ Apply adjustments per box
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

    // Recalculate dependent boxes to keep everything consistent
    box3 = box1 + box2;
    box5 = box3 - box4;

    // 7️⃣ Return HMRC-style summary + raw data
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
