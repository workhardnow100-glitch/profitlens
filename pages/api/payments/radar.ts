// pages/api/payments/radar.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    //
    // 1. Fetch Stripe payments (inserted by canonical webhook)
    //
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (paymentsError) {
      console.error("Failed to load payments:", paymentsError);
      return res.status(500).json({ error: "Failed to load payments" });
    }

    //
    // 2. Fetch invoice payments (matching engine + webhook)
    //
    const { data: invoicePayments, error: invoicePaymentsError } =
      await supabaseAdmin
        .from("invoice_payments")
        .select("*, invoices(*), transactions(*)")
        .order("created_at", { ascending: false });

    if (invoicePaymentsError) {
      console.error("Failed to load invoice payments:", invoicePaymentsError);
      return res.status(500).json({ error: "Failed to load invoice payments" });
    }

    //
    // 3. Fetch transactions (accounting ledger)
    //
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });

    if (txError) {
      console.error("Failed to load transactions:", txError);
      return res.status(500).json({ error: "Failed to load transactions" });
    }

    //
    // 4. Fetch invoices
    //
    const { data: invoices, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .order("issue_date", { ascending: false });

    if (invError) {
      console.error("Failed to load invoices:", invError);
      return res.status(500).json({ error: "Failed to load invoices" });
    }

    //
    // 5. Build Radar response
    //
    return res.status(200).json({
      payments,
      invoicePayments,
      transactions,
      invoices,
    });
  } catch (err) {
    console.error("Radar API error:", err);
    return res.status(500).json({ error: "Radar failed" });
  }
}
