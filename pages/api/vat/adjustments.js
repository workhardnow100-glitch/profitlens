// pages/api/vat/adjustment.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { clientId, vatPeriodId, box, amount, reason, userId } = req.body;

    if (!clientId || !box || amount === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const { data, error } = await supabase
        .from("vat_adjustments")
        .insert([
          {
            client_id: clientId,
            vat_period_id: vatPeriodId || null,
            box,
            amount,
            reason: reason || null,
            created_by: userId || null,
          },
        ])
        .select("*")
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, adjustment: data });
    } catch (err) {
      console.error("VAT adjustment insert error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    const { id, clientId } = req.body;

    if (!id || !clientId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const { error } = await supabase
        .from("vat_adjustments")
        .delete()
        .match({ id, client_id: clientId });

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("VAT adjustment delete error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
