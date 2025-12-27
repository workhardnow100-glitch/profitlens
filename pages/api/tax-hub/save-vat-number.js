// pages/api/tax-hub/save-vat-number.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ SESSION REQUIRED
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ⭐ Resolve clientId safely
  let clientId = null;

  if (session.user.role === "accountant") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  const { vatNumber } = req.body;

  if (!vatNumber) {
    return res.status(400).json({ error: "Missing vatNumber" });
  }

  // ⭐ Update VAT number
  const { error } = await supabaseAdmin
    .from("clients")
    .update({ vat_number: vatNumber })
    .eq("id", clientId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // ⭐ Audit log (accountant only)
  if (session.user.role === "accountant") {
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: "ACCOUNTANT_UPDATE_VAT_NUMBER",
        details: `Updated VAT number to ${vatNumber}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  return res.json({ success: true });
}
