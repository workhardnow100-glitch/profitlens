// pages/api/transactions/upsert.js

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

  try {
    const { id, ...updates } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "Missing transaction id" });
    }

    // Safety: never allow client_id/user_id to be changed through this endpoint
    delete updates.client_id;
    delete updates.user_id;
    delete updates.id;

    // Optional: coerce booleans if they come as strings
    const booleanFields = [
      "includedinvat",
      "includedincis",
      "includedinct",
      "includedinsa",
      "manualctoverride",
      "tax_locked",
    ];
    for (const key of booleanFields) {
      if (key in updates) {
        if (updates[key] === "true") updates[key] = true;
        if (updates[key] === "false") updates[key] = false;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("transactions")
      .update(updates)
      .eq("id", id)
      .eq("client_id", clientId)
      .select()
      .single();

    if (error) {
      console.error("❌ TX UPSERT ERROR:", error.message || error);
      return res.status(500).json({ error: error.message || "Update failed" });
    }

    return res.status(200).json({ success: true, transaction: data });
  } catch (err) {
    console.error("❌ TX UPSERT EXCEPTION:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
