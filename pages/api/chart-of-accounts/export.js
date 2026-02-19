// pages/api/chart-of-accounts/export.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import * as XLSX from "xlsx";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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

  const clientId =
    session.user.actingAsClientId || session.user.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  try {
    const { data: header, error: headerError } = await supabaseAdmin
      .from("chart_of_accounts")
      .select("id")
      .eq("client_id", clientId)
      .single();

    if (headerError && headerError.code === "PGRST116") {
      return res.status(400).json({ error: "No chart of accounts found" });
    }
    if (headerError) {
      console.error("CoA header fetch error:", headerError.message);
      return res.status(500).json({ error: headerError.message });
    }

    const { data: entries, error: entriesError } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("*")
      .eq("coa_id", header.id)
      .order("account_code", { ascending: true });

    if (entriesError) {
      console.error("CoA entries fetch error:", entriesError.message);
      return res.status(500).json({ error: entriesError.message });
    }

    const rows = (entries || []).map((e) => ({
      "Account Code": e.account_code,
      "Account Name": e.account_name,
      "Account Type": e.account_type,
      "HMRC Bucket": e.hmrc_bucket,
      Description: e.description || "",
      "System Account": e.is_system ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chart of Accounts");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const path = `${clientId}/coa-${dateStr}.xlsx`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("coa_exports")
      .upload(path, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadError) {
      console.error("CoA export upload error:", uploadError.message);
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("coa_exports")
      .createSignedUrl(path, 60 * 60); // 1 hour

    if (signedError) {
      console.error("CoA signed URL error:", signedError.message);
      return res.status(500).json({ error: signedError.message });
    }

    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_EXPORT_CHART_OF_ACCOUNTS",
          details: `Exported chart of accounts to Excel (${path})`,
        },
      ]);
    }

    return res.status(200).json({ url: signed.signedUrl });
  } catch (err) {
    console.error("❌ CoA export error:", err.message || err);
    return res.status(500).json({ error: "Failed to export chart of accounts" });
  }
}
