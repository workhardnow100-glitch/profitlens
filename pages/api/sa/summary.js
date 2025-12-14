// pages/api/sa/summary.js
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
    // Fetch income transactions
    const { data: incomeTx, error: incomeError } = await supabase
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .eq("type", "income");
    if (incomeError) throw new Error(incomeError.message);

    // Fetch expense transactions
    const { data: expenseTx, error: expenseError } = await supabase
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .eq("type", "expense");
    if (expenseError) throw new Error(expenseError.message);

    // Calculate totals
    const totalIncome = incomeTx.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = expenseTx.reduce((sum, t) => sum + (t.amount || 0), 0);
    const profit = totalIncome - totalExpenses;

    // Estimate income tax (simple example: 20%)
    const taxRate = 0.20;
    const taxLiability = profit > 0 ? profit * taxRate : 0;

    const transactions = [...incomeTx, ...expenseTx];

    res.status(200).json({
      totalIncome,
      totalExpenses,
      profit,
      taxLiability,
      transactions,
      locked: false,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
