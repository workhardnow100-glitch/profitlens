// pages/api/corp/summary.js
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
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // ✅ 1. Fetch Corporation Tax transactions
    const { data: corpTxs, error: fetchError } = await supabase
      .from("transactions")
      .select("id, date, category, amount, tax_locked")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    if (!corpTxs || corpTxs.length === 0) {
      return res.status(400).json({
        error: "No Corporation Tax transactions found for this period."
      });
    }

    // ✅ 2. Compute profit before tax
    let income = 0;
    let expenses = 0;

    corpTxs.forEach((tx) => {
      if (tx.category === "income") {
        income += Number(tx.amount || 0);
      }
      if (tx.category === "expense") {
        expenses += Number(tx.amount || 0);
      }
    });

    const profitBeforeTax = income - expenses;

    // ✅ 3. Compute Corporation Tax due
    const corpTaxRate = 0.19; // 19% for now
    const corpTaxDue = profitBeforeTax > 0 ? profitBeforeTax * corpTaxRate : 0;

    // ✅ 4. Effective rate (for display)
    const effectiveRate =
      profitBeforeTax > 0 ? (corpTaxDue / profitBeforeTax) * 100 : 0;

    // ✅ 5. Determine locked state
    const locked = corpTxs.some((tx) => tx.tax_locked === true);

    // ✅ 6. Return summary
    return res.status(200).json({
      success: true,
      periodStart,
      periodEnd,
      profitBeforeTax,
      corpTaxDue,
      effectiveRate,
      locked,
      transactions: corpTxs
    });

  } catch (err) {
    console.error("Corporation Tax summary error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

