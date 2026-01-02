import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  try {
    // 1. Fetch payouts
    const { data: payouts, error } = await supabaseAdmin
      .from("payment_payouts")
      .select(`
        id,
        amount,
        net,
        fee,
        status,
        arrival_date,
        created_at
      `)
      .order("arrival_date", { ascending: false });

    if (error) {
      console.error("Payout fetch error:", error);
      return res.status(500).json({ error: "Failed to load payouts" });
    }

    // 2. Fetch payout item counts (optional but useful)
    const { data: items } = await supabaseAdmin
      .from("payment_payout_items")
      .select("payout_id");

    const itemCounts = {};
    items?.forEach((i) => {
      itemCounts[i.payout_id] = (itemCounts[i.payout_id] || 0) + 1;
    });

    // 3. Attach item counts
    const enriched = payouts.map((p) => ({
      ...p,
      item_count: itemCounts[p.id] || 0,
    }));

    return res.status(200).json({ payouts: enriched });
  } catch (err) {
    console.error("Payout API error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
