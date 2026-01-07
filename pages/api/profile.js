// pages/api/profile.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";

// Unified allowed category list
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

  const role = (session.user.role || "").toUpperCase();
  const isFounder = role === "ADMIN" || role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  // ⭐ Accountants + founders bypass subscription checks
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId = isAccountant
    ? session.user.actingAsClientId
    : session.user.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  try {
    // ⭐ AUDIT LOG — View profile (all roles)
    if (req.method === "GET") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: isAccountant ? "ACCOUNTANT_VIEW_PROFILE" : "VIEW_PROFILE",
          details: "Viewed client profile and transaction summary",
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ POST — Update client identity fields (business owner only)
    if (req.method === "POST" && req.body.updateClient) {
      if (isAccountant) {
        return res
          .status(403)
          .json({ error: "Accountants cannot modify client identity" });
      }

      const updateFields = { ...req.body };
      delete updateFields.updateClient;

      const { error } = await supabaseAdmin
        .from("clients")
        .update(updateFields)
        .eq("id", clientId);

      if (error) throw error;

      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "UPDATE_CLIENT_PROFILE",
          details: `Updated client identity fields: ${Object.keys(updateFields).join(", ")}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      return res.status(200).json({ success: true });
    }

    // ⭐ POST — Update transaction category (business owner only)
    if (req.method === "POST" && !req.body.updateClient) {
      if (isAccountant) {
        return res
          .status(403)
          .json({ error: "Accountants cannot modify transaction categories" });
      }

      const { transactionId, newCategory } = req.body;

      if (!transactionId || !newCategory) {
        return res
          .status(400)
          .json({ error: "Missing transactionId or newCategory" });
      }

      const category = String(newCategory).trim();

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

      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "UPDATE_CATEGORY",
          details: `Updated category for transaction ${transactionId} → ${category}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      // After update, fall through to GET to return fresh data
      req.method = "GET";
    }

    // ⭐ GET — Profile data
    if (req.method === "GET") {
      // Fetch transactions
      const { data: transactions, error: txError } = await supabaseAdmin
        .from("transactions")
        .select(
          "id, date, description, amount, business_category, account_number, sort_code"
        )
        .eq("client_id", clientId)
        .order("date", { ascending: false });

      if (txError) throw txError;

      // Fetch HMRC categories
      const { data: hmrcCategories, error: hmrcError } = await supabaseAdmin
        .from("hmrc_categories")
        .select(
          "id, category_name, business_type, description, is_global, is_excluded"
        )
        .eq("is_global", true);

      if (hmrcError) throw hmrcError;

      // Fetch account details
      const { data: account, error: accError } = await supabaseAdmin
        .from("accounts")
        .select("account_number, sort_code")
        .eq("owner_id", clientId)
        .single();

      if (accError && accError.code !== "PGRST116") throw accError;

      // Fetch FULL client identity block
      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .select(`
          id,
          name,
          email,
          phone,
          address,
          postcode,
          business_type,
          business_name,
          trading_name,
          company_number,
          vat_number,
          utr_number,
          registered_address,
          industry,
          website,
          contact_person,
          contact_phone,
          contact_email,
          notes
        `)
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;

      const businessType = client?.business_type || "sole_trader";

      const totalsByType = {
        sole_trader: {},
        limited_company: {},
      };

      hmrcCategories.forEach((cat) => {
        if (!totalsByType[cat.business_type]) {
          totalsByType[cat.business_type] = {};
        }
        totalsByType[cat.business_type][cat.category_name] = 0;
      });

      let totalIncome = 0;
      let totalExpenses = 0;

      transactions.forEach((tx) => {
        let categoryName = tx.business_category || "Uncategorised";
        if (!ALLOWED_CATEGORIES.has(categoryName)) {
          categoryName = "Uncategorised";
        }

        const bt = businessType;

        if (!totalsByType[bt]) totalsByType[bt] = {};
        if (!totalsByType[bt][categoryName]) {
          totalsByType[bt][categoryName] = 0;
        }

        totalsByType[bt][categoryName] += Number(tx.amount || 0);

        if (tx.amount > 0) {
          totalIncome += tx.amount;
        } else {
          totalExpenses += Math.abs(tx.amount);
        }
      });

      const netProfit = totalIncome - totalExpenses;

      const soleTraderTaxRate = 0.2;
      const limitedCompanyTaxRate = 0.19;

      const soleTraderOwed =
        netProfit > 0 ? netProfit * soleTraderTaxRate : 0;
      const limitedCompanyOwed =
        netProfit > 0 ? netProfit * limitedCompanyTaxRate : 0;

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

      return res.status(200).json({
        client,
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
