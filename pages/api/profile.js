// pages/api/profile.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = session.user.id;
    const clientId = session.user.default_client_id;

    // ✅ Fetch client record (NEW)
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientError) {
      console.error("Client fetch error:", clientError);
      return res.status(500).json({ error: "Failed to load client" });
    }

    // ✅ Fetch account details
    const { data: account, error: accError } = await supabaseAdmin
      .from("accounts")
      .select("account_number, sort_code")
      .eq("owner_id", userId)
      .single();

    if (accError && accError.code !== "PGRST116") {
      console.error("Account fetch error:", accError);
      return res.status(500).json({ error: "Failed to load account" });
    }

    // ✅ Fetch transactions for this client
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: true });

    if (txError) {
      console.error("Transaction fetch error:", txError);
      return res.status(500).json({ error: "Failed to load transactions" });
    }

    // ✅ Fetch HMRC categories
    const { data: hmrcCategories, error: catError } = await supabaseAdmin
      .from("hmrc_categories")
      .select("*")
      .or(`client_id.eq.${clientId},is_global.eq.true`);

    if (catError) {
      console.error("HMRC category fetch error:", catError);
      return res.status(500).json({ error: "Failed to load HMRC categories" });
    }

    // ✅ Compute totals by type (sole trader / limited company)
    const totalsByType = {
      sole_trader: {},
      limited_company: {},
    };

    for (const tx of transactions || []) {
      const cat = tx.business_category || "Uncategorised";
      const amount = Number(tx.amount || 0);

      if (!totalsByType.sole_trader[cat]) totalsByType.sole_trader[cat] = 0;
      if (!totalsByType.limited_company[cat])
        totalsByType.limited_company[cat] = 0;

      if (amount > 0) {
        totalsByType.sole_trader[cat] += amount;
        totalsByType.limited_company[cat] += amount;
      } else {
        const abs = Math.abs(amount);
        totalsByType.sole_trader[cat] += abs;
        totalsByType.limited_company[cat] += abs;
      }
    }

    // ✅ Compute byMonth summary
    const byMonth = {};
    for (const tx of transactions || []) {
      if (!tx.date) continue;
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;

      if (!byMonth[key]) {
        byMonth[key] = { income: 0, expenses: 0 };
      }

      const amount = Number(tx.amount || 0);
      if (amount > 0) byMonth[key].income += amount;
      else byMonth[key].expenses += Math.abs(amount);
    }

    // ✅ Compute summary totals
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const tx of transactions || []) {
      const amount = Number(tx.amount || 0);
      if (amount > 0) totalIncome += amount;
      else totalExpenses += Math.abs(amount);
    }

    const netProfit = totalIncome - totalExpenses;

    const summary = {
      totalIncome,
      totalExpenses,
      netProfit,
      liabilities: {
        sole_trader: netProfit > 0 ? netProfit * 0.2 : 0,
        limited_company: netProfit > 0 ? netProfit * 0.19 : 0,
      },
    };

    // ✅ Handle category update (POST)
    if (req.method === "POST") {
      const { transactionId, newCategory } = req.body;

      const { error: updateError } = await supabaseAdmin
        .from("transactions")
        .update({ business_category: newCategory })
        .eq("id", transactionId);

      if (updateError) {
        console.error("Category update error:", updateError);
        return res.status(500).json({ error: "Failed to update category" });
      }

      return res.status(200).json({ success: true });
    }

    // ✅ Return full profile payload
    return res.status(200).json({
      client,
      account,
      transactions,
      hmrcCategories,
      totalsByType,
      byMonth,
      summary,
    });
  } catch (err) {
    console.error("Profile API error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
