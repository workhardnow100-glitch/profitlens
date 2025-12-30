import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const userId = session.user.id as string;
  const invoiceId = req.query.id as string;

  // -----------------------------
  // GET — Fetch full invoice
  // -----------------------------
  if (req.method === "GET") {
    try {
      // Fetch invoice - must belong to this user
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("user_id", userId)
        .single();

      if (invoiceError || !invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Fetch EXTERNAL CLIENT:
      // - join via invoice.client_id
      // - enforce owner_id = userId
      const { data: externalClient, error: externalClientError } =
        await supabaseAdmin
          .from("external_clients")
          .select("*")
          .eq("id", invoice.client_id)
          .eq("owner_id", userId)
          .single();

      if (externalClientError || !externalClient) {
        // We don't hard-fail the whole response, but you may prefer 404 here.
        // For now, mirror your existing behaviour:
        return res.status(404).json({ error: "External client not found" });
      }

      // Fetch line items - ordered by position
      const { data: lineItems, error: lineError } = await supabaseAdmin
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("position", { ascending: true });

      if (lineError) {
        console.error(lineError);
        return res.status(500).json({ error: "Failed to fetch line items" });
      }

      // Fetch matched payments with joined transactions
      const { data: payments, error: payError } = await supabaseAdmin
        .from("invoice_payments")
        .select(
          `
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
        `
        )
        .eq("invoice_id", invoiceId);

      if (payError) {
        console.error(payError);
        return res.status(500).json({ error: "Failed to fetch payments" });
      }

      // Derived values (for convenience in the UI)
      const paidAmount =
        payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) ?? 0;
      const balance = Number(invoice.gross_amount || 0) - paidAmount;

      return res.status(200).json({
        invoice,
        externalClient,
        lineItems: lineItems ?? [],
        payments: payments ?? [],
        // extra computed values (non-breaking)
        paidAmount,
        balance,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  // -----------------------------
  // PUT — Update invoice
  // -----------------------------
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .eq("user_id", userId)
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

  // -----------------------------
  // DELETE — Cancel invoice
  // -----------------------------
  if (req.method === "DELETE") {
    try {
      const { error } = await supabaseAdmin
        .from("invoices")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .eq("user_id", userId);

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
