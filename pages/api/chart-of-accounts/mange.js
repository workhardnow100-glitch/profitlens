// pages/api/chart-of-accounts/manage.js
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

  const clientId = session.user.actingAsClientId || session.user.clientId;
  if (!clientId) {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { action, payload } = req.body;

  // Fetch COA header for this client
  const { data: header } = await supabaseAdmin
    .from("chart_of_accounts")
    .select("id")
    .eq("client_id", clientId)
    .single();

  if (!header) {
    return res.status(400).json({ error: "No COA found" });
  }

  // ---------------------------
  // ⭐ ADD ACCOUNT
  // ---------------------------
  if (action === "add") {
    const { name, type, bucket, description } = payload;

    const { error } = await supabaseAdmin
      .from("chart_of_account_entries")
      .insert([
        {
          coa_id: header.id,
          account_name: name,
          account_type: type,
          hmrc_bucket: bucket,
          description: description || null,
          is_system: false,
          has_activity: false,
          account_code: null, // auto-assigned by sync engine
        },
      ]);

    if (error) return res.status(500).json({ error: "Failed to add account" });
    return res.status(200).json({ success: true });
  }

  // ---------------------------
  // ⭐ UPDATE ACCOUNT
  // ---------------------------
  if (action === "update") {
    const { id, name, type, bucket, description } = payload;

    // Validate ownership
    const { data: account } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id, coa_id")
      .eq("id", id)
      .single();

    if (!account) return res.status(404).json({ error: "Account not found" });
    if (account.coa_id !== header.id)
      return res.status(403).json({ error: "Not allowed" });

    const { error } = await supabaseAdmin
      .from("chart_of_account_entries")
      .update({
        account_name: name,
        account_type: type,
        hmrc_bucket: bucket,
        description: description || null,
      })
      .eq("id", id);

    if (error)
      return res.status(500).json({ error: "Failed to update account" });

    return res.status(200).json({ success: true });
  }

  // ---------------------------
  // ⭐ DELETE ACCOUNT
  // ---------------------------
  if (action === "delete") {
    const { id } = payload;

    const { data: account } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id, coa_id, is_system, has_activity")
      .eq("id", id)
      .single();

    if (!account) return res.status(404).json({ error: "Account not found" });
    if (account.coa_id !== header.id)
      return res.status(403).json({ error: "Not allowed" });

    if (account.is_system)
      return res.status(400).json({ error: "Cannot delete system accounts" });

    if (account.has_activity)
      return res
        .status(400)
        .json({ error: "Cannot delete accounts with activity" });

    const { error } = await supabaseAdmin
      .from("chart_of_account_entries")
      .delete()
      .eq("id", id);

    if (error)
      return res.status(500).json({ error: "Failed to delete account" });

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: "Unknown action" });
}
