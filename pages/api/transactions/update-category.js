// pages/api/transactions/update-category.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  const { id, business_category } = req.body;

  if (!id || !business_category) {
    return res.status(400).json({
      error: "Missing required fields: id, business_category",
    });
  }

  try {
    const { error } = await supabaseAdmin
      .from("transactions")
      .update({
        business_category: business_category.trim(),
      })
      .eq("id", id);

    if (error) {
      console.error("❌ Supabase update error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      id,
      business_category,
    });
  } catch (err) {
    console.error("❌ Update-category API error:", err.message || err);
    return res.status(500).json({
      error: "Failed to update business category",
    });
  }
}
