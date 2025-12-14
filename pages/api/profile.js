// pages/api/profile.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const clientId = session.user.clientId;
  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  try {
    // ✅ Handle category update
    if (req.method === "POST") {
      const { transactionId, newCategoryId } = req.body;
      if (!transactionId || !newCategoryId) {
        return res.status(400).json({ error: "Missing transactionId or newCategoryId" });
      }

      const { error } = await supabaseAdmin
        .from("transactions")
        .update({ hmrc_category_id: newCategoryId })
        .eq("id", transactionId)
        .eq("client_id", clientId);

      if (error) throw error;

      req.method = "GET"; // fall through to GET
    }

    if (req.method === "GET") {
      // ✅ Fetch transactions
      const { data: transactions, error: txError } = await supabaseAdmin
        .from("transactions")
        .select("id, date, description, amount, hmrc_category_id, account_number, sort_code")
        .eq("client_id", clientId)
        .order("date", { ascending: false });

      if (txError) throw txError;

      // ✅ Fetch global HMRC categories
      const { data: hmrcCategories, error: hmrcError } = await supabaseAdmin
        .from("hmrc_categories")
        .select("id, category_name, business_type, description, is_global, is_excluded")
        .eq("is_global", true);

      if (hmrcError) throw hmrcError;

      // ✅ Fetch account details
      const { data: account, error: accError } = await supabaseAdmin
        .from("accounts")
        .select("account_number, sort_code")
        .eq("owner_id", session.user.id)
        .single();

      if (accError && accError.code !== "PGRST116") throw accError;

      // ✅ Initialize totals safely
      const totalsByType = {
        sole_trader: {},
        limited_company: {}
      };

      // ✅ Pre-fill known HMRC categories
      hmrcCategories.forEach(cat => {
        if (!totalsByType[cat.business_type]) {
          totalsByType[cat.business_type] = {};
        }
        totalsByType[cat.business_type][cat.category_name] = 0;
      });

      let totalIncome = 0;
      let totalExpenses = 0;

      // ✅ Compute totals safely
      transactions.forEach(tx => {
        const cat = hmrcCategories.find(c => c.id === tx.hmrc_category_id);
        const catName = cat?.category_name || tx.hmrc_category_id || "Uncategorised";
        const businessType = cat?.business_type || "sole_trader";

        // ✅ Ensure object exists
        if (!totalsByType[businessType]) totalsByType[businessType] = {};
        if (!totalsByType[businessType][catName]) totalsByType[businessType][catName] = 0;

        totalsByType[businessType][catName] += Number(tx.amount || 0);

        if (cat?.is_excluded) return;

        if (tx.amount > 0) {
          totalIncome += tx.amount;
        } else {
          totalExpenses += Math.abs(tx.amount);
        }
      });

      const netProfit = totalIncome - totalExpenses;

      // ✅ Tax calculations
      const soleTraderTaxRate = 0.20;
      const limitedCompanyTaxRate = 0.19;

      const soleTraderOwed = netProfit > 0 ? netProfit * soleTraderTaxRate : 0;
      const limitedCompanyOwed = netProfit > 0 ? netProfit * limitedCompanyTaxRate : 0;

      // ✅ Group by month safely
      const byMonth = {};

      transactions.forEach(tx => {
        const month = new Date(tx.date).toISOString().slice(0, 7);
        if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0 };

        const cat = hmrcCategories.find(c => c.id === tx.hmrc_category_id);
        const catName = cat?.category_name || tx.hmrc_category_id || "";
        const businessType = cat?.business_type || "sole_trader";

        if (cat?.is_excluded) return;

        if (tx.amount > 0) {
          byMonth[month].income += tx.amount;
        } else {
          byMonth[month].expenses += Math.abs(tx.amount);
        }
      });

      return res.status(200).json({
        transactions,
        hmrcCategories,
        account: account || null,
        summary: {
          totalIncome,
          totalExpenses,
          netProfit,
          liabilities: {
            sole_trader: soleTraderOwed,
            limited_company: limitedCompanyOwed,
          },
        },
        totalsByType,
        byMonth,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("Profile API error:", err.message || err);
    return res.status(500).json({ error: "Failed to load profile data" });
  }
}
