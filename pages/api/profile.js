////



import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";
import { requireRole } from "../../lib/rbac";

// Unified allowed category list (UI only)
const ALLOWED_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
  ...SYSTEM_CATEGORIES,
  "Uncategorised",
]);

export default async function handler(req, res) {
  const guard = await requireRole(req, res, [
    "USER",
    "ACCOUNTANT",
    "ADMIN",
    "FOUNDER",
  ]);
  if (!guard.ok) return;

  const role = guard.role;
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";

  const subscriptionStatus = req?.session?.user?.subscriptionStatus;
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    subscriptionStatus
  );

  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  const clientId = guard.actingAsClientId || guard.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const actorEmail = req.session?.user?.email || "unknown";

  try {
    // ⭐ AUDIT LOG — View profile
    if (req.method === "GET") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: actorEmail,
          action: isAccountant ? "ACCOUNTANT_VIEW_PROFILE" : "VIEW_PROFILE",
          details: "Viewed client profile and transaction summary",
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ POST — Update client identity fields
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
          actor_email: actorEmail,
          action: "UPDATE_CLIENT_PROFILE",
          details: `Updated client identity fields: ${Object.keys(
            updateFields
          ).join(", ")}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      return res.status(200).json({ success: true });
    }

    // ⭐ POST — Update transaction category (UI only)
    if (req.method === "POST" && !req.body.updateClient) {
      if (isAccountant) {
        return res.status(403).json({
          error: "Accountants cannot modify transaction categories",
        });
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
          actor_email: actorEmail,
          action: "UPDATE_CATEGORY",
          details: `Updated category for transaction ${transactionId} → ${category}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      req.method = "GET";
    }

    // ⭐ GET — COA-driven profile data
    if (req.method === "GET") {
      // 1) Fetch transactions with COA + toggles
      const { data: transactions, error: txError } = await supabaseAdmin
        .from("transactions")
        .select(
          `
          id,
          date,
          description,
          amount,
          business_category,
          account_number,
          sort_code,
          coa_id,
          includedinct,
          includedinvat
        `
        )
        .eq("client_id", clientId)
        .order("date", { ascending: false });

      if (txError) throw txError;

      const txs = transactions ?? [];

      // 2) Load COA entries
      const distinctCoaIds = Array.from(
        new Set(txs.map((t) => t.coa_id).filter(Boolean))
      );

      const coaMap = new Map();
      if (distinctCoaIds.length > 0) {
        const { data: coaRows, error: coaErr } = await supabaseAdmin
          .from("chart_of_account_entries")
          .select(
            "id, account_type, hmrc_bucket, is_control_account, is_bank_account"
          )
          .in("id", distinctCoaIds);

        if (coaErr) throw coaErr;
        (coaRows || []).forEach((row) => coaMap.set(row.id, row));
      }

      // 3) Fetch client identity block
      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .select(
          `
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
        `
        )
        .eq("id", clientId)
        .single();

      if (clientError) throw clientError;

      const businessType = client?.business_type || "sole_trader";

      // 4) COA-driven totals
      let totalIncome = 0;
      let totalExpenses = 0;

      const hmrcTotals = {};

      const byMonth = {};

      for (const tx of txs) {
        const amount = Number(tx.amount || 0);
        const date = new Date(tx.date);
        const monthKey = date.toISOString().slice(0, 7);

        if (!byMonth[monthKey]) {
          byMonth[monthKey] = { income: 0, expenses: 0 };
        }

        const coa = coaMap.get(tx.coa_id);
        if (!coa) continue;

        const bucket = coa.hmrc_bucket;
        const accType = coa.account_type;

        const isControl =
          bucket === "control" ||
          bucket === "system" ||
          bucket === "balance_sheet" ||
          bucket === "equity" ||
          bucket === "liabilities" ||
          bucket === "assets" ||
          coa.is_control_account ||
          coa.is_bank_account;

        if (isControl) continue;

        const includeForProfit = tx.includedinct !== false;
        if (!includeForProfit) continue;

        const absAmount = Math.abs(amount);

        if (accType === "INCOME" && amount > 0) {
          totalIncome += amount;
          byMonth[monthKey].income += amount;

          if (!hmrcTotals[bucket]) hmrcTotals[bucket] = 0;
          hmrcTotals[bucket] += absAmount;
        }

        if (accType === "EXPENSE" && amount < 0) {
          totalExpenses += absAmount;
          byMonth[monthKey].expenses += absAmount;

          if (!hmrcTotals[bucket]) hmrcTotals[bucket] = 0;
          hmrcTotals[bucket] += absAmount;
        }
      }

      const netProfit = totalIncome - totalExpenses;

      const soleTraderTaxRate = 0.2;
      const limitedCompanyTaxRate = 0.19;

      const soleTraderOwed =
        netProfit > 0 ? netProfit * soleTraderTaxRate : 0;
      const limitedCompanyOwed =
        netProfit > 0 ? netProfit * limitedCompanyTaxRate : 0;

      return res.status(200).json({
        client,
        transactions: txs, // UI categories preserved
        summary: {
          totalIncome,
          totalExpenses,
          netProfit,
          liabilities: {
            sole_trader: soleTraderOwed,
            limited_company: limitedCompanyOwed,
          },
        },
        hmrcTotals, // COA-driven category totals
        byMonth, // COA-driven monthly breakdown
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Profile API error:", err);
    return res.status(500).json({ error: "Failed to load profile data" });
  }
}
