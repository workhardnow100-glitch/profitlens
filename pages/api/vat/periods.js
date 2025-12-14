// pages/api/vat/periods.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId } = req.query;

  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  // Fetch all VAT transactions for this client
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("date, tax_locked")
    .eq("client_id", clientId)
    .not("vat_rate", "is", null)
    .order("date", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Group transactions into quarterly periods
  const periodsMap = {};
  transactions.forEach(tx => {
    const d = new Date(tx.date);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0–11
    const quarter = Math.floor(month / 3) + 1;
    const periodKey = `${year}-Q${quarter}`;

    if (!periodsMap[periodKey]) {
      periodsMap[periodKey] = { locked: true }; // assume locked, check below
    }
    if (!tx.tax_locked) periodsMap[periodKey].locked = false;
  });

  const periods = Object.entries(periodsMap).map(([period, info]) => ({
    period,
    locked: info.locked
  }));

  // Sort descending (latest first)
  periods.sort((a, b) => (a.period < b.period ? 1 : -1));

  res.json({ periods });
}
