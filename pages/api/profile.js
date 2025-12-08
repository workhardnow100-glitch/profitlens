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
    // Fetch all transactions for this client
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, date, description, amount, hmrc_category_id, account_number, sort_code")
      .eq("client_id", clientId)
      .order("date", { ascending: false });
    if (txError) throw txError;

    // Fetch all HMRC categories for this client
    const { data: hmrcCategories, error: hmrcError } = await supabaseAdmin
      .from("hmrc_categories")
      .select("id, category_name, business_type, description");
    if (hmrcError) throw hmrcError;

    // Fetch account details
    const { data: account, error: accError } = await supabaseAdmin
      .from("accounts")
      .select("account_number, sort_code")
      .eq("owner_id", session.user.id)
      .single();
    if (accError && accError.code !== "PGRST116") throw accError;

    // Prepare totals for each business type
    const totalsByType = {
      sole_trader: {},
      limited_company: {},
    };

    hmrcCategories.forEach(cat => {
      totalsByType[cat.business_type][cat.category_name] = 0;
    });

    let totalIncome = 0;
    let totalExpenses = 0;

    // Compute totals
    transactions.forEach(tx => {
      const cat = hmrcCategories.find(c => c.id === tx.hmrc_category_id);
      const catName = cat?.category_name || "Uncategorised";
      const businessType = cat?.business_type || "sole_trader";

      // Add to the correct category total
      totalsByType[businessType][catName] =
        (totalsByType[businessType][catName] || 0) + Number(tx.amount || 0);

      // Update summary
      if (tx.amount > 0) totalIncome += tx.amount;
      else totalExpenses += Math.abs(tx.amount);
    });

    const netProfit = totalIncome - totalExpenses;

    // Tax rates (adjust as needed)
    const soleTraderTaxRate = 0.20;       // 20% income tax
    const limitedCompanyTaxRate = 0.19;   // 19% corporation tax

    // Calculate liabilities
    const soleTraderOwed = netProfit > 0 ? netProfit * soleTraderTaxRate : 0;
    const limitedCompanyOwed = netProfit > 0 ? netProfit * limitedCompanyTaxRate : 0;

    // Group transactions by month
    const byMonth = {};
    transactions.forEach(tx => {
      const month = new Date(tx.date).toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0 };
      if (tx.amount > 0) byMonth[month].income += tx.amount;
      else byMonth[month].expenses += Math.abs(tx.amount);
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

  } catch (err) {
    console.error("Profile API error:", err.message || err);
    return res.status(500).json({ error: "Failed to load profile data" });
  }
}
