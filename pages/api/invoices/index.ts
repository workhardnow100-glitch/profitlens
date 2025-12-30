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

  //
  // ---------------------------------------------------------
  // POST — CREATE INVOICE
  // ---------------------------------------------------------
  //
  if (req.method === "POST") {
    try {
      const {
        externalClientId,   // UPDATED — replaces clientId
        invoiceNumber,
        issueDate,
        dueDate,
        paymentTerms,
        lineItems,
        paymentInstructions,
        notesToClient,
        markSent,
      } = req.body;

      if (!externalClientId) {
        return res.status(400).json({ error: "Missing externalClientId" });
      }

      // Calculate totals
      const subtotal = lineItems.reduce(
        (sum: number, li: any) => sum + li.quantity * li.unitPrice,
        0
      );

      const vatTotal = lineItems.reduce(
        (sum: number, li: any) =>
          sum + li.quantity * li.unitPrice * (li.vatRate / 100),
        0
      );

      const grossTotal = subtotal + vatTotal;

      const status = markSent ? "sent" : "draft";

      const finalInvoiceNumber = invoiceNumber || `INV-${Date.now()}`;

      //
      // Insert invoice
      //
      const { data: invoice, error } = await supabaseAdmin
        .from("invoices")
        .insert({
          user_id: userId,
          external_client_id: externalClientId, // UPDATED
          invoice_number: finalInvoiceNumber,
          status,
          issue_date: issueDate,
          due_date: dueDate,
          currency: "GBP",
          net_amount: subtotal,
          tax_amount: vatTotal,
          gross_amount: grossTotal,
          payment_terms: paymentTerms,
          payment_instructions: paymentInstructions ?? {},
          notes_to_client: notesToClient ?? "",
        })
        .select()
        .single();

      if (error || !invoice) {
        console.error(error);
        return res.status(500).json({ error: "Failed to create invoice" });
      }

      //
      // Insert line items
      //
      const lineRows = lineItems.map((li: any, index: number) => ({
        invoice_id: invoice.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unitPrice,
        line_total: li.quantity * li.unitPrice,
        vat_rate: li.vatRate,
        position: index,
        category: li.category ?? null,
      }));

      const { error: linesError } = await supabaseAdmin
        .from("invoice_line_items")
        .insert(lineRows);

      if (linesError) {
        console.error(linesError);
        return res.status(500).json({ error: "Failed to create line items" });
      }

      return res.status(201).json({ invoice });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  //
  // ---------------------------------------------------------
  // GET — LIST INVOICES
  // ---------------------------------------------------------
  //
  if (req.method === "GET") {
    try {
      const { status, q } = req.query;

      let query = supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("user_id", userId);

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      if (q) {
        query = query.ilike("invoice_number", `%${q}%`);
      }

      const { data, error } = await query.order("issue_date", {
        ascending: false,
      });

      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch invoices" });
      }

      return res.status(200).json({ invoices: data });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
