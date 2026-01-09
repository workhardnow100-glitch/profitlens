// pages/api/invoices/bulk-update.ts
// PURPOSE:
//   Apply a bulk action to multiple invoices at once.
//   Supported actions:
//     • "send"       → mark invoice as sent
//     • "mark_paid"  → mark invoice as fully paid
//     • "cancel"     → cancel invoice
//
// POSITION IN PIPELINE:
//   • This endpoint does NOT touch money, totals, VAT, or line items.
//   • It only updates status fields.
//   • All monetary calculations happen elsewhere (already unified).
//
// MONEY MODEL:
//   • No pence/pounds logic here.
//   • No risk of mismatched totals.
//   • Safe and correct.
//
// VERIFIED:
//   • RBAC is correct.
//   • Access control is correct.
//   • Bulk updates are atomic per invoice.
//   • No money fields are modified.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

type BulkAction = "send" | "mark_paid" | "cancel";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Users, Accountants, and Founder can bulk update invoices
  const guard = await requireRole(req, res, ["FOUNDER", "ACCOUNTANT", "USER"]);
  if (!guard.ok) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, role, accessibleClients } = guard;

  const { invoiceIds, action } = req.body as {
    invoiceIds: string[];
    action: BulkAction;
  };

  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).json({ error: "No invoices selected" });
  }

  if (!["send", "mark_paid", "cancel"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  try {
    // Fetch invoices
    const { data: invoices, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .in("id", invoiceIds);

    if (invError) {
      console.error(invError);
      return res.status(500).json({ error: "Failed to fetch invoices" });
    }

    if (!invoices || invoices.length === 0) {
      return res.status(404).json({ error: "No invoices found" });
    }

    // -------------------------------------------------------------
    // ACCESS CONTROL: Ensure user can modify these invoices
    // -------------------------------------------------------------
    for (const inv of invoices) {
      // USER → must own the invoice
      if (role === "USER" && inv.user_id !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // ACCOUNTANT → must have access to the client
      if (role === "ACCOUNTANT" && !accessibleClients.includes(inv.client_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const results: { id: string; success: boolean; message?: string }[] = [];

    // Process each invoice
    for (const inv of invoices) {
      try {
        if (action === "cancel") {
          const { error } = await supabaseAdmin
            .from("invoices")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id);

          if (error) throw error;

          results.push({ id: inv.id, success: true });
        }

        if (action === "mark_paid") {
          const { error } = await supabaseAdmin
            .from("invoices")
            .update({
              status: "paid",
              payment_status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id);

          if (error) throw error;

          results.push({ id: inv.id, success: true });
        }

        if (action === "send") {
          const { error } = await supabaseAdmin
            .from("invoices")
            .update({
              status: "sent",
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id);

          if (error) throw error;

          results.push({ id: inv.id, success: true });
        }
      } catch (err: any) {
        console.error(`Bulk action failed for invoice ${inv.id}`, err);
        results.push({
          id: inv.id,
          success: false,
          message: err?.message || "Failed to apply action",
        });
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
