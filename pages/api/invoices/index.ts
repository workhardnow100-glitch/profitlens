// pages/api/invoices/index.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // apiVersion can be pinned if you want, e.g. "2024-06-20"
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const userId = session.user.id as string;

  //
  // ---------------------------------------------------------
  // POST — CREATE INVOICE (with automatic Stripe Payment Link)
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
      // 2) Insert line items (in pence)
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
      // 3) (Optional but recommended) Fetch external client for metadata / future use
      //
      const { data: externalClient, error: externalClientError } =
        await supabaseAdmin
          .from("external_clients")
          .select("*")
          .eq("id", clientId)
          .eq("owner_id", userId)
          .single();

      if (externalClientError || !externalClient) {
        console.error("External client not found or error:", externalClientError);
        // We still proceed with invoice + payment link, but without relying on email here.
      }

      //
      // 4) Create Stripe Product + Price + Payment Link
      //    This is the automatic Payments Engine: every invoice is payment-ready.
      //
      const metadata = {
        invoice_id: String(invoice.id),
        invoice_number: String(finalInvoiceNumber),
        user_id: String(userId),
        client_id: String(clientId),
      };

      // 4a) Create Product for this invoice
      const product = await stripe.products.create({
        name: `Invoice ${finalInvoiceNumber}`,
        metadata,
      });

      // 4b) Create Price for the invoice total (gross, in pence)
      const price = await stripe.prices.create({
        currency: "gbp",
        unit_amount: totalPence,
        product: product.id,
        metadata,
      });

      // 4c) Create Payment Link
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        metadata,
        // Optional: after completion, redirect back to the invoice page
        after_completion: {
          type: "redirect",
          redirect: {
            url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}?paid=1`,
          },
        },
      });

      //
      // 5) Store payment link URL on the invoice
      //    (We reuse the existing stripe_payment_link_url column.)
      //
      const { data: updatedInvoice, error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({
          stripe_payment_link_url: paymentLink.url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)
        .select()
        .single();

      if (updateError || !updatedInvoice) {
        console.error("Failed to update invoice with payment link:", updateError);
        return res
          .status(500)
          .json({ error: "Invoice created but failed to attach payment link" });
      }

      //
      // 6) Return the fully payment-ready invoice
      //
      return res.status(201).json({ invoice: updatedInvoice });
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
