// pages/api/sa/submit.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { clientId, periodStart, periodEnd } = req.body;
  if (!clientId || !periodStart || !periodEnd) return res.status(400).json({ error: "Missing parameters" });

  try {
    // Optional: check for incomplete transactions
    const { data: incompleteTx, error: checkError } = await supabase
      .from("transactions")
      .select("id")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .is("amount", null);
    if (checkError) throw new Error(checkError.message);

    if (incompleteTx.length > 0) {
      return res.status(400).json({ error: "Cannot submit. Some transactions are incomplete." });
    }

    // Lock all transactions for SA period
    const { data, error } = await supabase
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (error) throw new Error(error.message);

    return res.status(200).json({ success: true, lockedTransactions: data.length });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
