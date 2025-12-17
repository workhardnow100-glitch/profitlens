// pages/api/transactions/update-category.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { CATEGORIES } from "../../../lib/constants/categories";
import { SYSTEM_CATEGORIES } from "../../../lib/constants/systemCategories";

// Build a flat set of all valid categories from your constants
const ALL_CATEGORIES = new Set([
  ...CATEGORIES.income,
  ...CATEGORIES.allowable,
  ...CATEGORIES.disallowable,
  ...CATEGORIES.dla,
  ...CATEGORIES.tax,
  ...SYSTEM_CATEGORIES,
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

  // ✅ Normalise category
  category = String(category).trim();

  // ✅ Validate category against constants
  if (!ALL_CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  try {
    const { error } = await supabaseAdmin
      .from("transactions")
      .update({ business_category: category })
      .eq("id", transactionId)
      .eq("client_id", clientId);

    if (error) {
      console.error("Update category error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Update category exception:", err);
    return res.status(500).json({ error: "Failed to update category" });
  }
}
