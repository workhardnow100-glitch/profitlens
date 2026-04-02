// pages/api/accounts/meta.js
import { supabaseAdmin } from "../../../supabase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const { clientId, periodStart, periodEnd } = req.body;

    if (!clientId || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: "Missing clientId, periodStart or periodEnd",
      });
    }

    // Load existing
    const { data: rows, error: loadError } = await supabaseAdmin
      .from("client_accounts_periods")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd);

    if (loadError) {
      return res.status(500).json({ success: false, error: loadError.message });
    }

    let meta = rows?.[0] || null;

    // Auto-create if missing
    if (!meta) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("client_accounts_periods")
        .insert([
          {
            client_id: clientId,
            period_start: periodStart,
            period_end: periodEnd,
          },
        ])
        .select()
        .single();

      if (insertError) {
        return res.status(500).json({ success: false, error: insertError.message });
      }

      meta = inserted;
    }

    return res.status(200).json({ success: true, meta });
  } catch (err) {
    console.error("ACCOUNTS META LOAD ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
