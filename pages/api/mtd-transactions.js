// pages/api/mtd-dashboard.js
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  const { method } = req;

  try {
    if (method === "POST") {
      const { action, clientId, rowId, category, vatRate, nino, payload, period } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: "Missing clientId" });
      }

      switch (action) {
        // 🔹 Fetch transactions
        case "fetchTransactions": {
          const { data, error } = await supabaseAdmin
            .from("transactions")
            .select("id, date, description, amount, vat_rate, vat_amount, category")
            .eq("client_id", clientId)
            .order("date", { ascending: false });

          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ data });
        }

        // 🔹 Update category
        case "updateCategory": {
          const update = { category };
          if (category !== "vat") {
            update.vat_rate = null;
            update.vat_amount = null;
          }
          const { error } = await supabaseAdmin
            .from("transactions")
            .update(update)
            .eq("id", rowId);

          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ success: true });
        }

        // 🔹 Update VAT
        case "updateVAT": {
          const { data: tx } = await supabaseAdmin
            .from("transactions")
            .select("amount")
            .eq("id", rowId)
            .single();

          const vatAmount = tx.amount * (vatRate / 100);

          const { error } = await supabaseAdmin
            .from("transactions")
            .update({ vat_rate: vatRate, vat_amount: vatAmount })
            .eq("id", rowId);

          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ success: true });
        }

        // 🔹 Check VAT lock
        case "checkLock": {
          const vatPeriod = new Date().toISOString().slice(0, 7);
          const { data, error } = await supabaseAdmin
            .from("vat_periods")
            .select("id, locked, submitted")
            .eq("client_id", clientId)
            .eq("period_start", `${vatPeriod}-01`)
            .maybeSingle();

          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ locked: data?.locked || data?.submitted || false });
        }

        // 🔹 Verify CIS
        case "verifyCIS": {
          // Example: call HMRC CIS API or stub
          const registered = nino && nino.startsWith("AB"); // fake check
          await supabaseAdmin
            .from("clients")
            .update({ cis_registered: registered })
            .eq("id", clientId);

          return res.status(200).json({ registered });
        }

        // 🔹 Submit to HMRC
        case "submitMTD": {
          const idempotencyKey = `${clientId}-${period}-${category}`;
          const { error } = await supabaseAdmin.from("mtd_submissions").insert({
            client_id: clientId,
            category,
            payload,
            period,
            idempotency_key: idempotencyKey,
            submitted_at: new Date().toISOString(),
          });

          if (error) return res.status(500).json({ error: error.message });
          return res.status(200).json({ success: true });
        }

        default:
          return res.status(400).json({ error: "Unknown action" });
      }
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (e) {
    console.error("❌ MTD API error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
