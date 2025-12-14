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

  // 1️⃣ Fetch transactions for client + date range, include tax_locked
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("client_id", clientId)
    .gte("date", periodStart)
    .lte("date", periodEnd)
    .not("vat_rate", "is", null);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // 2️⃣ Determine if all transactions in this period are locked
  const isLocked = transactions.length > 0 && transactions.every(tx => tx.tax_locked);

  // 3️⃣ Calculate VAT boxes
  let box1 = 0;
  let box4 = 0;
  let box6 = 0;
  let box7 = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    const vat = Number(tx.vat_amount || 0);

    if (amount > 0) {
      // Sales
      box1 += vat;
      box6 += amount;
    } else {
      // Purchases
      box4 += Math.abs(vat);
      box7 += Math.abs(amount);
    }
  }

  const box3 = box1;         // Total VAT due on sales
  const box5 = box3 - box4;  // Net VAT to pay

  return res.json({
    period: `${periodStart} → ${periodEnd}`,
    locked: isLocked,
    boxes: {
      box1: Number(box1.toFixed(2)),
      box3: Number(box3.toFixed(2)),
      box4: Number(box4.toFixed(2)),
      box5: Number(box5.toFixed(2)),
      box6: Number(box6.toFixed(2)),
      box7: Number(box7.toFixed(2))
    },
    transactions
  });
}
