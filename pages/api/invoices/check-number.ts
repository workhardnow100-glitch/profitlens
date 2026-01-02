// /pages/api/invoices/check-number.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabase-client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const invoiceNumber = req.query.invoiceNumber as string;

  if (!invoiceNumber) {
    return res.status(400).json({ error: "Missing invoiceNumber" });
  }

  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("id")
      .eq("invoice_number", invoiceNumber)
      .limit(1);

    if (error) {
      console.error("Error checking invoice number:", error);
      return res.status(500).json({ error: "Failed to check invoice number" });
    }

    const exists = data && data.length > 0;

    return res.status(200).json({ exists });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
