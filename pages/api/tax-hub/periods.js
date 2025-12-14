import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to group transactions by period
function groupByPeriod(transactions, periodType) {
  const periods = {};
  transactions.forEach((t) => {
    let label = "", start = t.date, end = t.date;

    if (periodType === "vat") {
      const d = new Date(t.date);
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      label = `${d.getFullYear()} Q${quarter}`;
      start = new Date(d.getFullYear(), (quarter - 1) * 3, 1)
        .toISOString()
        .split("T")[0];
      end = new Date(d.getFullYear(), quarter * 3, 0)
        .toISOString()
        .split("T")[0];
    } else if (periodType === "cis") {
      const d = new Date(t.date);
      label = `${d.getFullYear()}-${d.getMonth() + 1}`;
      start = new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];
    } else {
      const d = new Date(t.date);
      label = `${d.getFullYear()}`;
      start = new Date(d.getFullYear(), 0, 1).toISOString().split("T")[0];
      end = new Date(d.getFullYear(), 11, 31).toISOString().split("T")[0];
    }

    if (!periods[label])
      periods[label] = { periodLabel: label, periodStart: start, periodEnd: end, locked: false };

    if (t.tax_locked) periods[label].locked = true;
  });

  return Object.values(periods);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  try {
    // Fetch all transactions for client
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("client_id", clientId);

    if (txError) throw new Error(txError.message);

    // Fetch HMRC token, safely handle if none exists
    const { data: tokens, error: tokenError } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("client_id", clientId)
      .limit(1);

    if (tokenError) console.warn("HMRC token fetch warning:", tokenError.message);

    const token = Array.isArray(tokens) && tokens.length > 0 ? tokens[0] : null;
    const hasHMRC = token?.access_token ? true : false;

    // Filter transactions by tax type
    const vatTx = transactions.filter((t) => t.hmrc_category_id === "VAT");
    const cisTx = transactions.filter((t) => t.hmrc_category_id === "CIS");
    const corpTx = transactions.filter((t) => t.type === "income" || t.type === "expense");
    const saTx = transactions.filter((t) => t.type === "income" || t.type === "expense");

    res.status(200).json({
      vat: groupByPeriod(vatTx, "vat").map((p) => ({ ...p, hmrcAuthorized: hasHMRC })),
      cis: groupByPeriod(cisTx, "cis").map((p) => ({ ...p, hmrcAuthorized: hasHMRC })),
      corp: groupByPeriod(corpTx, "annual"),
      sa: groupByPeriod(saTx, "annual"),
    });
  } catch (err) {
    console.error("Tax Hub periods error:", err);
    res.status(500).json({ error: err.message });
  }
}
