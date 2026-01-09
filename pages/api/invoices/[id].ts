// pages/api/invoices/[id].ts
// PURPOSE:
//   Fetch, update, or cancel a single invoice.
//
// MONEY MODEL (CRITICAL):
//   • Invoice amounts are stored in PENCE.
//   • The previous version incorrectly used invoice.total (non‑existent).
//   • Balance must be computed using gross_amount / 100.
//   • This fix aligns manual invoices with the unified money system.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guard = await requireRole(req, res, ["FOUNDER", "ACCOUNTANT", "USER"]);
  if (!guard.ok) return;

  const { userId, role, accessibleClients } = guard;
  const invoiceId = req.query.id as string;

  // -------------------------------------------------------------
  // Fetch invoice first (for access control)
  // -------------------------------------------------------------
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  // -------------------------------------------------------------
  // ACCESS CONTROL
  // -------------------------------------------------------------
  if (role === "USER" && invoice.user_id !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (role === "ACCOUNTANT" && !accessibleClients.includes(invoice.client_id)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // -------------------------------------------------------------
  // GET — Fetch full invoice
  // -------------------------------------------------------------
  if (req.method === "GET") {
    try {
      const { data: externalClient, error: externalClientError } =
        await supabaseAdmin
          .from("external_clients")
          .select("*")
          .eq("id", invoice.client_id)
          .eq("owner_id", invoice.user_id)
          .single();

      if (externalClientError || !externalClient) {
        return res.status(404).json({ error: "External client not found" });
      }

      const { data: lineItems, error: lineError } = await supabaseAdmin
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("position", { ascending: true });

      if (lineError) {
        console.error(lineError);
        return res.status(500).json({ error: "Failed to fetch line items" });
      }

      const { data: payments, error: payError } = await supabaseAdmin
        .from("invoice_payments")
        .select(`
          id,
          invoice_id,
          transaction_id,
          amount,
          matched_at,
          match_confidence,
          source,
          notes,
          created_at,
          transactions (
            id,
            date,
            description,
            amount,
            source
          )
        `)
        .eq("invoice_id", invoiceId);

      if (payError) {
        console.error(payError);
        return res.status(500).json({ error: "Failed to fetch payments" });
      }

      const paidAmount =
        payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) ?? 0;

      // ⭐ FIXED: Use gross_amount (pence) → pounds
      const balance = Number(invoice.gross_amount || 0) / 100 - paidAmount;

      return res.status(200).json({
        invoice,
        externalClient,
        lineItems: lineItems ?? [],
        payments: payments ?? [],
        paidAmount,
        balance,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  // -------------------------------------------------------------
  // PUT — Update invoice
  // -------------------------------------------------------------
  if (req.method === "PUT") {
    try {
      const {
        invoiceNumber,
        issueDate,
        dueDate,
        paymentTerms,
        paymentInstructions,
        notesToClient,
        status,
        paymentStatus,
      } = req.body;

      const { data: updated, error } = await supabaseAdmin
        .from("invoices")
        .update({
          invoice_number: invoiceNumber,
          issue_date: issueDate,
          due_date: dueDate,
          payment_terms: paymentTerms,
          payment_instructions: paymentInstructions,
          notes_to_client: notesToClient,
          status,
          payment_status: paymentStatus ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .select()
        .single();

      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to update invoice" });
      }

      return res.status(200).json({ invoice: updated });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  // -------------------------------------------------------------
  // DELETE — Cancel invoice
  // -------------------------------------------------------------
  if (req.method === "DELETE") {
    try {
      const { error } = await supabaseAdmin
        .from("invoices")
        .update({
          status: "cancelled",
          payment_status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to cancel invoice" });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
