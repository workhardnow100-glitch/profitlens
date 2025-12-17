// pages/api/transactions/update-category.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { CT_MAP } from "../../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../../lib/constants/systemCategories";

// ✅ Build unified allowed category list
const ALLOWED_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
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

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  let { transactionId, category } = req.body || {};

  if (!transactionId || !category) {
    return res.status(400).json({ error: "Missing transactionId or category" });
  }

  // ✅ Clean category
  category = String(category).trim();

  // ✅ Validate category against HMRC constants
  if (!ALLOWED_CATEGORIES.has(category)) {
    return res.status(400).json({
      error: `Invalid category: "${category}". Must be one of the defined HMRC categories.`,
    });
  }

  try {
    const { error } = await supabaseAdmin
      .from("transactions")
      .update({ business_category: category })
      .eq("id", transactionId)
      .eq("client_id", clientId);

    if (error) {
      console.error("Update category error:", error.message);
      return res.status(500).json({ error: "Failed to update category" });
    }

    return res.status(200).json({ success: true, transactionId, category });
  } catch (err) {
    console.error("Update category exception:", err);
    return res.status(500).json({ error: "Failed to update category" });
  }
}
