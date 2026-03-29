// pages/api/transactions/upsert.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { CT_MAP } from "../../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../../lib/constants/systemCategories";


const ALLOWED_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.other_income,     // ⭐ REQUIRED
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.fixed_assets,     // ⭐ REQUIRED
  ...CT_MAP.current_assets,   // ⭐ REQUIRED
  ...CT_MAP.liabilities,      // ⭐ REQUIRED
  ...CT_MAP.equity,           // ⭐ REQUIRED
  ...CT_MAP.ignore,
  ...SYSTEM_CATEGORIES,
  "Uncategorised",
]);


export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = session.user.role;
  const isFounder = role === "admin";
  const isAccountant = role === "accountant";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // Accountant-aware client scoping
  const clientId =
    session.user.actingAsClientId || session.user.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { id, ...fields } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing transaction ID" });
  }

  try {
    // ---------------------------------------------------------
    // 1) Fetch transaction for access control
    // ---------------------------------------------------------
    const { data: tx, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // ---------------------------------------------------------
    // 2) ACCESS CONTROL
    // ---------------------------------------------------------
    if (role === "user" && tx.client_id !== clientId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (isAccountant && tx.client_id !== clientId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Founder bypasses all checks

    // ---------------------------------------------------------
    // 3) Validate fields
    // ---------------------------------------------------------

    // Validate category
    if (fields.business_category) {
      const clean = String(fields.business_category).trim();
      if (!ALLOWED_CATEGORIES.has(clean)) {
        return res.status(400).json({
          error: `Invalid category "${clean}". Must be HMRC-aligned.`,
        });
      }
      fields.business_category = clean;
    }

    // Validate VAT
    if (fields.vat_rate != null) {
      const rate = Number(fields.vat_rate);
      if (![0, 5, 20].includes(rate)) {
        return res.status(400).json({ error: "Invalid VAT rate" });
      }
      fields.vat_rate = rate;
    }

    if (fields.vat_amount != null) {
      fields.vat_amount = Number(fields.vat_amount);
      if (isNaN(fields.vat_amount)) {
        return res.status(400).json({ error: "Invalid VAT amount" });
      }
    }

    // Validate CIS
    if (fields.cis_type != null) {
      if (!["none", "deducted", "suffered"].includes(fields.cis_type)) {
        return res.status(400).json({ error: "Invalid CIS type" });
      }
    }

    // Validate SA
    if (fields.includedinsa != null) {
      fields.includedinsa = Boolean(fields.includedinsa);
    }

    // Validate CT flags
    if (fields.includedinct != null) {
      fields.includedinct = Boolean(fields.includedinct);
    }
    if (fields.manualctoverride != null) {
      fields.manualctoverride = Boolean(fields.manualctoverride);
    }

    // Validate asset disposal fields
    if (fields.assetdisposaltype) {
      const allowed = ["MAIN_POOL", "SPECIAL_RATE_POOL", "CARS", "SHORT_LIFE"];
      if (!allowed.includes(fields.assetdisposaltype)) {
        return res.status(400).json({ error: "Invalid asset disposal type" });
      }
    }

    // ---------------------------------------------------------
    // 4) Build update payload
    // ---------------------------------------------------------
    const updatePayload = {
      ...fields,
      updatedat: new Date().toISOString(),
    };

    // ---------------------------------------------------------
    // 5) Perform update
    // ---------------------------------------------------------
    const { error } = await supabaseAdmin
      .from("transactions")
      .update(updatePayload)
      .eq("id", id)
      .eq("client_id", clientId);

    if (error) {
      console.error("Upsert error:", error);
      return res.status(500).json({ error: error.message });
    }

    // ---------------------------------------------------------
    // 5.1) Mark CoA entry as used (dynamic CoA)
    // ---------------------------------------------------------
    if (fields.business_category) {
      await supabaseAdmin
        .from("chart_of_account_entries")
        .update({ has_activity: true })
        .eq("account_name", fields.business_category)
        .eq("coa_id", tx.coa_id || null);
    }

    // ---------------------------------------------------------
    // 6) Accountant audit log
    // ---------------------------------------------------------
    if (isAccountant) {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_UPDATE_TRANSACTION",
          details: `Updated transaction ${id}`,
        },
      ]);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Upsert API error:", err);
    return res.status(500).json({ error: "Failed to update transaction" });
  }
}
