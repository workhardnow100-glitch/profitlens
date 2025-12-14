// pages/api/mtd-dashboards.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Basic HMRC-aligned category inference
function inferCategory(type = "", description = "") {
  const desc = (description || "").toUpperCase();
  if (/SERVICE CHARGES|INTEREST|COMPANIESHOUSE|BANK/i.test(desc)) return "corp";
  if (/CONSTRUC|CIS/i.test(desc)) return "cis";
  if (/VAT|HMRC/i.test(desc)) return "vat";
  if (/PAYMENT|CREDIT|INVOICE|CLIENT|SALES|REVENUE/i.test(desc)) return "income";
  return "other";
}

// Check if VAT period is locked/submitted
async function isVatLocked(clientId) {
  const vatPeriod = new Date().toISOString().slice(0, 7);
  const { data, error } = await supabaseAdmin
    .from("vat_periods")
    .select("locked, submitted")
    .eq("client_id", clientId)
    .eq("period_start", `${vatPeriod}-01`)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.locked || data?.submitted);
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, clientId, rowId, category, vatNumber } = req.body;
  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  try {
    switch (action) {
      // Fetch transactions
      case "fetchTransactions": {
        const { data, error } = await supabaseAdmin
          .from("transactions")
          .select("id, date, description, amount, vat_rate, vat_amount, category, type, is_reversal")
          .eq("client_id", clientId)
          .order("date", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        const recent = (data || [])
          .filter(tx => !tx.is_reversal)
          .map(tx => ({
            id: tx.id,
            date: tx.date,
            amount: round2(tx.amount),
            description: tx.description,
            category: tx.category || inferCategory(tx.type, tx.description),
            vat_rate: tx.vat_rate ?? null,
            vat_amount: tx.vat_amount != null ? round2(tx.vat_amount) : null,
          }));

        return res.status(200).json({ data: recent });
      }

      // Update category (used for CIS flagging etc.)
      case "updateCategory": {
        const locked = await isVatLocked(clientId);
        if (locked) return res.status(423).json({ error: "VAT period locked or submitted" });
        if (!rowId || !category) return res.status(400).json({ error: "Missing rowId or category" });

        const update = { category };
        if (category !== "vat") {
          update.vat_rate = null;
          update.vat_amount = null;
        }

        const { error } = await supabaseAdmin
          .from("transactions")
          .update(update)
          .eq("id", rowId)
          .eq("client_id", clientId);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      }

      // Update VAT number for client
      case "updateVATNumber": {
        if (!vatNumber) return res.status(400).json({ error: "Missing vatNumber" });
        const { error } = await supabaseAdmin
          .from("clients")
          .update({ vat_number: vatNumber })
          .eq("id", clientId);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      }

      // Check VAT lock
      case "checkLock": {
        const locked = await isVatLocked(clientId);
        return res.status(200).json({ locked });
      }

      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (err) {
    console.error("MTD Dashboards API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
