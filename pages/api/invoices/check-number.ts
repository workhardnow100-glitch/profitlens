// pages/api/invoices/check-number.ts
// PURPOSE:
//   Check whether a given invoice number already exists for the authenticated user.
//
// POSITION IN PIPELINE:
//   • Used by the UI when creating or editing invoices.
//   • Ensures invoice numbers remain unique per user.
//   • Does NOT touch money, totals, VAT, or line items.
//
// MONEY MODEL:
//   • No monetary fields are read or written.
//   • No pence/pounds conversions.
//   • Safe and correct.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Users, Accountants, and Founder can check invoice numbers
  const guard = await requireRole(req, res, ["FOUNDER", "ACCOUNTANT", "USER"]);
  if (!guard.ok) return;

  const { userId, role, accessibleClients } = guard;

  const invoiceNumber = req.query.invoiceNumber as string;

  if (!invoiceNumber) {
    return res.status(400).json({ error: "Missing invoiceNumber" });
  }

  try {
    // Fetch invoice by number
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("id, user_id, client_id")
      .eq("invoice_number", invoiceNumber)
      .limit(1);

    if (error) {
      console.error("Error checking invoice number:", error);
      return res.status(500).json({ error: "Failed to check invoice number" });
    }

    const exists = data && data.length > 0;

    // If invoice exists, enforce access control
    if (exists) {
      const inv = data[0];

      // USER → must own the invoice
      if (role === "USER" && inv.user_id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // ACCOUNTANT → must have access to the client
      if (role === "ACCOUNTANT" && !accessibleClients.includes(inv.client_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return res.status(200).json({ exists });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
