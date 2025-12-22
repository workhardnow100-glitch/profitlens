// pages/api/tax-hub/save-vat-number.js
import { supabase } from "../../../../lib/supabase-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, vatNumber } = req.body;

  if (!clientId || !vatNumber) {
    return res.status(400).json({ error: "Missing clientId or vatNumber" });
  }

  // Update the client's VAT number
  const { error } = await supabase
    .from("clients")
    .update({ vat_number: vatNumber })
    .eq("id", clientId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ success: true });
}
