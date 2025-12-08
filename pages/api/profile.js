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
    // ✅ Handle transaction category update
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

      return res.status(200).json({ success: true });
    }

    // ✅ Default GET behaviour
    if (req.method === "GET") {
      // Fetch all transactions
      const { data: transactions, error: txError } = await supabaseAdmin
        .from("transactions")
        .select("id, date, description, amount, hmrc_category_id, account_number, sort_code")
        .eq("client_id", clientId)
        .order("date", { ascending: false });
      if (txError) throw txError;

      // Fetch HMRC categories
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

      // ✅ Define allowable expense categories
      const allowableExpenses = {
        sole_trader: [
          "Office, property, and equipment",
          "Travel",
          "Staff costs",
          "Marketing and subscriptions",
          "Legal and financial costs",
          "Mobile & Internet",
          "Fuel",
          "Advertising",
          "Insurance",
          "Training & development",
          "Subscriptions & memberships",
          "Bank Fees",
          "Professional fees",
          "Charitable donations",
          "Bad debts",
          "Capital allowances"
        ],
        limited_company: [
          "Office costs",
          "Travel and subsistence",
          "Staff salaries and wages",
          "Employer NICs and pensions",
          "Professional fees",
          "Marketing & advertising",
          "Insurance",
          "Training & development",
          "Subscriptions & memberships",
          "Bank charges & interest",
          "IT & software",
          "Charitable donations",
          "Bad debts",
          "Capital allowances"
        ]
      };

      // ✅ Excluded categories (not income/expenses)
      const excludedCategories = [
        "Transfer Between Accounts",
        "Transfer In",
        "Cash Withdrawal",
        "Returned DD",
        "Direct Debit"
      ];

      // Prepare totals
      const totalsByType = { sole_trader: {}, limited_company: {} };
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

        totalsByType[businessType][catName] =
          (totalsByType[businessType][catName] || 0) + Number(tx.amount || 0);

        // Skip excluded categories
        if (excludedCategories.includes(catName)) return;

        if (tx.amount > 0) {
          totalIncome += tx.amount;
        } else {
          if (allowableExpenses[businessType]?.includes(catName)) {
            totalExpenses += Math.abs(tx.amount);
          }
        }
      });

      const netProfit = totalIncome - totalExpenses;

      // Tax rates
      const soleTraderTaxRate = 0.20;
      const limitedCompanyTaxRate = 0.19;

      const soleTraderOwed = netProfit > 0 ? netProfit * soleTraderTaxRate : 0;
      const limitedCompanyOwed = netProfit > 0 ? netProfit * limitedCompanyTaxRate : 0;

      // Group by month
      const byMonth = {};
      transactions.forEach(tx => {
        const month = new Date(tx.date).toISOString().slice(0, 7);
        if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0 };

        const cat = hmrcCategories.find(c => c.id === tx.hmrc_category_id);
        const catName = cat?.category_name || "";
        const businessType = cat?.business_type || "sole_trader";

        if (excludedCategories.includes(catName)) return;

        if (tx.amount > 0) {
          byMonth[month].income += tx.amount;
        } else {
          if (allowableExpenses[businessType]?.includes(catName)) {
            byMonth[month].expenses += Math.abs(tx.amount);
          }
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
