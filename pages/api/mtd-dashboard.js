import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

function inferCategory(type = "", description = "") {
  const normalized = type?.trim().toUpperCase() || "";
  if (normalized === "FPO") return "Payment";
  if (normalized === "TFR") return "Transfer";
  if (normalized === "CHG") return "Bank Charges";
  if (normalized === "DEB") return "Debit";
  if (normalized === "DD") return "Direct Debit";
  if (normalized === "SO") return "Standing Order";
  if (normalized === "INT") return "Interest";

  const rules = [
    { regex: /\bTESCO|SAINSBURY|MORRISONS|ASDA|ALDI|LIDL|WAITROSE\b/i, category: "Groceries" },
    { regex: /\bJUST\s*EAT|DELIVEROO|UBER\s*EATS|DOMINOS|MCDONALDS|KFC|SUBWAY|NANDO/i, category: "Food & Drink" },
    { regex: /\bAMAZON|EBAY|ARGOS|ETSY\b/i, category: "Shopping" },
    { regex: /\bUBER|LYFT|TAXI|TRAINLINE|NATIONAL\s*RAIL|TFL\b/i, category: "Transport" },
    { regex: /\bRYANAIR|EASYJET|JET2|BRITISH\s*AIRWAYS\b/i, category: "Travel" },
    { regex: /\bBP|SHELL|ESSO|TEXACO|PETROL|FUEL\b/i, category: "Fuel" },
    { regex: /\bBT|VODAFONE|O2|EE|THREE|SKY|VIRGIN\s*MEDIA\b/i, category: "Utilities" },
    { regex: /\bNETFLIX|SPOTIFY|DISNEY|APPLE\s*MUSIC|AMAZON\s*PRIME|NOW\s*TV|YOUTUBE\s*PREMIUM\b/i, category: "Subscriptions" },
    { regex: /\bHMRC|TAX|VAT|COMPANIES\s*HOUSE\b/i, category: "Business & Tax" },
  ];

  for (const rule of rules) if (rule.regex.test(description)) return rule.category;
  return "Other";
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const { action, clientId, rowId, category, vatRate, nino } = req.body;

  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  try {
    if (action === "fetchTransactions") {
      const { data, error } = await supabaseAdmin
        .from("transactions")
        .select("id, date, description, amount, vat_rate, vat_amount, category, type, is_reversal")
        .eq("client_id", clientId)
        .order("date", { ascending: false });

      if (error) return res.status(500).json({ error: error.message });

      const recent = data
        .filter(tx => !tx.is_reversal)
        .map(tx => ({
          id: tx.id,
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
          category: tx.category || inferCategory(tx.type, tx.description),
          vat_rate: tx.vat_rate,
          vat_amount: tx.vat_amount,
        }));

      return res.status(200).json({ data: recent });
    }

    if (action === "updateCategory") {
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

    if (action === "updateVAT") {
      if (!rowId || vatRate === undefined) return res.status(400).json({ error: "Missing rowId or vatRate" });

      const { data: tx, error: txError } = await supabaseAdmin
        .from("transactions")
        .select("amount")
        .eq("id", rowId)
        .eq("client_id", clientId)
        .single();

      if (txError) return res.status(500).json({ error: txError.message });

      const vatAmount = tx.amount * (vatRate / 100);

      const { error } = await supabaseAdmin
        .from("transactions")
        .update({ vat_rate: vatRate, vat_amount: vatAmount })
        .eq("id", rowId)
        .eq("client_id", clientId);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    if (action === "verifyCIS") {
      const registered = nino && nino.startsWith("AB"); // simple stub for demo
      return res.status(200).json({ registered });
    }

    if (action === "checkLock") {
      const vatPeriod = new Date().toISOString().slice(0, 7);
      const { data, error } = await supabaseAdmin
        .from("vat_periods")
        .select("locked, submitted")
        .eq("client_id", clientId)
        .eq("period_start", `${vatPeriod}-01`)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ locked: data?.locked || data?.submitted || false });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("MTD Dashboard API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
