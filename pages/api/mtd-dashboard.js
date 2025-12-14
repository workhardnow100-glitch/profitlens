import { supabaseAdmin } from "../../lib/supabase-admin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { action, clientId, rowId, category, vatRate } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: "Missing clientId" });
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", session.user.id)
    .single();

  if (!client) {
    return res.status(403).json({ error: "Forbidden" });
  }

  switch (action) {
    case "fetchClient": {
      const { data } = await supabaseAdmin
        .from("clients")
        .select("id, nino, cis_registered")
        .eq("id", clientId)
        .single();
      return res.json({ data });
    }

    case "fetchTransactions": {
      const { data } = await supabaseAdmin
        .from("transactions")
        .select("id, date, description, amount, vat_rate, vat_amount, category")
        .eq("client_id", clientId)
        .order("date", { ascending: false });
      return res.json({ data });
    }

    case "checkLock": {
      const period = new Date().toISOString().slice(0, 7);
      const { data } = await supabaseAdmin
        .from("vat_periods")
        .select("locked")
        .eq("client_id", clientId)
        .eq("period_start", `${period}-01`)
        .maybeSingle();
      return res.json({ locked: !!data?.locked });
    }

    case "updateCategory": {
      await supabaseAdmin
        .from("transactions")
        .update({
          category,
          vat_rate: category === "vat" ? undefined : null,
          vat_amount: category === "vat" ? undefined : null,
        })
        .eq("id", rowId)
        .eq("client_id", clientId);
      return res.json({ success: true });
    }

    case "updateVAT": {
      const { data: tx } = await supabaseAdmin
        .from("transactions")
        .select("amount")
        .eq("id", rowId)
        .eq("client_id", clientId)
        .single();

      const vatAmount = Math.abs(tx.amount) * (vatRate / 100);

      await supabaseAdmin
        .from("transactions")
        .update({ vat_rate: vatRate, vat_amount: vatAmount })
        .eq("id", rowId);

      return res.json({ success: true });
    }

    default:
      return res.status(400).json({ error: "Unknown action" });
  }
}
