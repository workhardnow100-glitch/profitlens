// pages/api/invoices/[id]/update-line-items.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const userId = session.user.id as string;
  const invoiceId = req.query.id as string;

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { lineItems } = req.body;

    if (!Array.isArray(lineItems)) {
      return res.status(400).json({ error: "Invalid line items payload" });
    }

    //
    // 1) Fetch invoice (ownership check)
    //
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .single();

    if (invoiceError || !invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    //
    // 2) Delete existing line items (clean slate)
    //
    const { error: deleteError } = await supabaseAdmin
      .from("invoice_line_items")
      .delete()
      .eq("invoice_id", invoiceId);

    if (deleteError) {
      console.error(deleteError);
      return res.status(500).json({ error: "Failed to clear existing line items" });
    }

    //
    // 3) Insert new line items
    //
    const preparedItems = lineItems.map((li: any, index: number) => ({
      id: li.id || undefined,
      invoice_id: invoiceId,
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      vat_rate: Number(li.vat_rate),
      line_total:
        Number(li.quantity) *
        Number(li.unit_price) *
        (1 + Number(li.vat_rate) / 100),
      position: index,
    }));

    const { data: insertedItems, error: insertError } = await supabaseAdmin
      .from("invoice_line_items")
      .insert(preparedItems)
      .select();

    if (insertError) {
      console.error(insertError);
      return res.status(500).json({ error: "Failed to insert line items" });
    }

    //
    // 4) Recalculate totals
    //
    const net = insertedItems.reduce(
      (sum: number, li: any) => sum + Number(li.quantity) * Number(li.unit_price),
      0
    );

    const tax = insertedItems.reduce(
      (sum: number, li: any) =>
        sum +
        Number(li.quantity) *
          Number(li.unit_price) *
          (Number(li.vat_rate) / 100),
      0
    );

    const gross = net + tax;

    //
    // 5) Update invoice totals
    //
    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({
        net_amount: net,
        tax_amount: tax,
        gross_amount: gross,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      console.error(updateError);
      return res.status(500).json({ error: "Failed to update invoice totals" });
    }

    //
    // 6) Return updated invoice + items
    //
    return res.status(200).json({
      invoice: updatedInvoice,
      lineItems: insertedItems,
    });
  } catch (err) {
    console.error("Update line items error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
