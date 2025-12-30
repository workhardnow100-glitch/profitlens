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

  // Accountant-aware client ID
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
    // Only update fields provided
    const updatePayload = {
      ...fields,
      updatedat: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("transactions")
      .update(updatePayload)
      .eq("id", id)
      .eq("client_id", clientId);

    if (error) {
      console.error("Upsert error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Upsert API error:", err);
    return res.status(500).json({ error: "Failed to update transaction" });
  }
}
