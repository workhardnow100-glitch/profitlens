// pages/api/profile.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";

// ✅ Unified allowed category list
const ALLOWED_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
  ...SYSTEM_CATEGORIES,
  "Uncategorised",
]);

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const clientId = session.user.clientId;
  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  try {
    // ✅ POST — Update category (validated)
    if (req.method === "POST") {
      const { transactionId, newCategory } = req.body;

      if (!transactionId || !newCategory) {
        return res
          .status(400)
          .json({ error: "Missing transactionId or newCategory" });
      }

      const category = String(newCategory).trim();

      // ✅ Validate category
      if (!ALLOWED_CATEGORIES.has(category)) {
        return res.status(400).json({
          error: `Invalid category: "${category}". Must be a defined HMRC category.`,
        });
      }

      const { error } = await supabaseAdmin
        .from("transactions")
        .update({ business_category: category })
        .eq("id", transactionId)
        .eq("client_id", clientId);

      if (error) throw error;

      req.method = "GET"; // fall through to GET
    }

    // ✅ GET — Profile data
    if (req.method === "GET") {
      // ✅ Fetch transactions
      const { data: transactions, error: txError } = await supabaseAdmin
        .from("transactions")
        .select(
          "id, date, description, amount, business_category, account_number, sort_code"
        )
        .eq("client_id", clientId)
        .order("date", { ascending: false });

      if (txError) throw txError;

      // ✅ Fetch HMRC categories (optional, used for UI)
      const { data: hmrcCategories, error: hmrcError } = await supabaseAdmin
        .from("hmrc_categories")
        .select(
          "id, category_name, business_type, description, is_global, is_excluded"
        )
        .eq("is_global", true);

      if (hmrcError) throw hmrcError;

      // ✅ Fetch account details
      const { data: account, error: accError } = await supabaseAdmin
        .from("accounts")
        .select("account_number, sort_code")
        .eq("owner_id", session.user.id)
        .single();

      if (accError && accError.code !== "PGRST116") throw accError;

      // ✅ ✅ ✅ NEW — Fetch client details (ONLY ADDITION)
      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("id, name, email, phone, address, postcode, business_type")
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;

      // ✅ Totals by business type
      const totalsByType = {
        sole_trader: {},
        limited_company: {},
      };

      // ✅ Pre-fill HMRC categories (UI only)
      hmrcCategories.forEach((cat) => {
        if (!totalsByType[cat.business_type]) {
          totalsByType[cat.business_type] = {};
        }
        totalsByType[cat.business_type][cat.category_name] = 0;
      });

      let totalIncome = 0;
      let totalExpenses = 0;

      // ✅ Compute totals using validated business_category
      transactions.forEach((tx) => {
        let categoryName = tx.business_category || "Uncategorised";
        if (!ALLOWED_CATEGORIES.has(categoryName)) {
          categoryName = "Uncategorised";
        }

        const businessType = "sole_trader"; // default

        if (!totalsByType[businessType]) totalsByType[businessType] = {};
        if (!totalsByType[businessType][categoryName]) {
          totalsByType[businessType][categoryName] = 0;
        }

        totalsByType[businessType][categoryName] += Number(tx.amount || 0);

        if (tx.amount > 0) {
          totalIncome += tx.amount;
        } else {
          totalExpenses += Math.abs(tx.amount);
        }
      });

      const netProfit = totalIncome - totalExpenses;

      // ✅ Tax calculations
      const soleTraderTaxRate = 0.2;
      const limitedCompanyTaxRate = 0.19;

      const soleTraderOwed =
        netProfit > 0 ? netProfit * soleTraderTaxRate : 0;
      const limitedCompanyOwed =
        netProfit > 0 ? netProfit * limitedCompanyTaxRate : 0;

      // ✅ Group by month
      const byMonth = {};
      transactions.forEach((tx) => {
        const month = new Date(tx.date).toISOString().slice(0, 7);
        if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0 };
        if (tx.amount > 0) {
          byMonth[month].income += tx.amount;
        } else {
          byMonth[month].expenses += Math.abs(tx.amount);
        }
      });

      // ✅ ✅ ✅ RETURN — Add client to response (ONLY ADDITION)
      return res.status(200).json({
        client, // ✅ NEW
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
