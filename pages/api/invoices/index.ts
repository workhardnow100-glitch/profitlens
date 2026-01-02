// pages/api/invoices/index.ts

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
  // POST — CREATE INVOICE (Stripe temporarily disabled)
  // ---------------------------------------------------------
  //
  if (req.method === "POST") {
    try {
      const {
        clientId,
        invoiceNumber,
        issueDate,
        dueDate,
        paymentTerms,
        lineItems,
        paymentInstructions,
        notesToClient,
        markSent,
      } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: "Missing clientId" });
      }

      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({ error: "Missing line items" });
      }

      // Calculate totals (in pounds)
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

      // Convert to pence
      const subtotalPence = Math.round(subtotal * 100);
      const vatPence = Math.round(vatTotal * 100);
      const totalPence = Math.round(grossTotal * 100);

      const status = markSent ? "sent" : "draft";
      const finalInvoiceNumber = invoiceNumber || `INV-${Date.now()}`;

      //
      // 1) Insert invoice
      //
      const { data: invoice, error } = await supabaseAdmin
        .from("invoices")
        .insert({
          user_id: userId,
          client_id: clientId,
          invoice_number: finalInvoiceNumber,
          status,
          payment_status: "unpaid",
          issue_date: issueDate,
          due_date: dueDate,
          currency: "GBP",
          net_amount: subtotalPence,
          tax_amount: vatPence,
          gross_amount: totalPence,
          payment_terms: paymentTerms,
          payment_instructions: paymentInstructions ?? {},
          notes_to_client: notesToClient ?? "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !invoice) {
        console.error(error);
        return res.status(500).json({ error: "Failed to create invoice" });
      }

      //
      // 2) Insert line items
      //
      const lineRows = lineItems.map((li: any, index: number) => ({
        invoice_id: invoice.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: Math.round(li.unitPrice * 100),
        line_total: Math.round(li.quantity * li.unitPrice * 100),
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

      //
      // 3) Return invoice WITHOUT Stripe payment link (for now)
      //
      return res.status(201).json({
        invoice: {
          ...invoice,
          stripe_payment_link_url: null, // placeholder until Stripe is re-enabled
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  //
  // ---------------------------------------------------------
  // GET — LIST INVOICES (pure Supabase, always works)
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

      const { data, error } = await query.order("created_at", {
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
