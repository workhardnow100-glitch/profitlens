// pages/api/invoices/[id]/match.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

type MatchType = "full" | "partial" | "overpayment";

interface InvoiceRow {
  id: string;
  user_id: string;
  client_id: string;
  issue_date: string;
  total: number; // pence
  status: string;
  payment_status: string | null;
  invoice_number: string;
}

interface TransactionRow {
  id: string;
  user_id: string;
  client_id: string;
  amount: number; // pounds
  description: string | null;
  date: string;
}

interface MatchResult {
  transaction: TransactionRow;
  confidence: number;
  match_type: MatchType;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const userId = session.user.id as string;
  const invoiceId = req.query.id as string;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    //
    // 1) Fetch invoice
    //
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .single<InvoiceRow>();

    if (invoiceError || !invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    //
    // 2) Prevent duplicate matching
    //
    const { data: existingPayments } = await supabaseAdmin
      .from("invoice_payments")
      .select("id")
      .eq("invoice_id", invoiceId);

    if (existingPayments && existingPayments.length > 0) {
      return res.status(200).json({
        matched: true,
        reason: "Invoice already matched",
      });
    }

    //
    // 3) Fetch candidate transactions
    //
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("client_id", invoice.client_id)
      .gte("date", invoice.issue_date)
      .order("date", { ascending: true });

    if (txError) {
      console.error(txError);
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    const txList = (transactions ?? []) as TransactionRow[];
    const matches: MatchResult[] = [];

    //
    // 4) Scoring logic
    //
    const invAmount = Number(invoice.total) / 100; // convert pence → pounds

    for (const tx of txList) {
      const txAmount = Number(tx.amount) || 0;

      let confidence = 0;
      let match_type: MatchType = "full";

      // Rule A: exact amount
      if (txAmount === invAmount) confidence += 70;

      // Rule B: near amount (±£1)
      if (Math.abs(txAmount - invAmount) <= 1) confidence += 60;

      // Rule C: partial
      if (txAmount < invAmount) {
        confidence += 40;
        match_type = "partial";
      }

      // Rule D: overpayment
      if (txAmount > invAmount) {
        confidence += 40;
        match_type = "overpayment";
      }

      // Rule E: description contains invoice number
      if (tx.description && tx.description.includes(invoice.invoice_number)) {
        confidence += 50;
      }

      // Rule F: date proximity (±7 days)
      const txDate = new Date(tx.date).getTime();
      const issueDate = new Date(invoice.issue_date).getTime();
      const daysDiff = Math.abs(txDate - issueDate) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 7) confidence += 5;

      matches.push({ transaction: tx, confidence, match_type });
    }

    //
    // 5) Pick best match
    //
    matches.sort((a, b) => b.confidence - a.confidence);
    const best = matches[0];

    if (!best || best.confidence < 50) {
      return res.status(200).json({
        matched: false,
        reason: "No strong match found",
        matches,
      });
    }

    //
    // 6) Create invoice_payments row
    //
    const { error: payError } = await supabaseAdmin
      .from("invoice_payments")
      .insert({
        invoice_id: invoiceId,
        transaction_id: best.transaction.id,
        amount: best.transaction.amount,
        match_confidence: best.confidence >= 70 ? "high" : "medium",
        source: "auto",
      });

    if (payError) {
      console.error(payError);
      return res.status(500).json({ error: "Failed to create invoice payment" });
    }

    //
    // 7) Update invoice status
    //
    const newStatus = best.match_type === "full" ? "paid" : "part_paid";
    const newPaymentStatus = best.match_type === "full" ? "paid" : "processing";

    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({
        status: newStatus,
        payment_status: newPaymentStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (updateError) {
      console.error(updateError);
      return res.status(500).json({ error: "Failed to update invoice status" });
    }

    return res.status(200).json({
      matched: true,
      match: best,
      matches,
    });
  } catch (err) {
    console.error("Matching engine error:", err);
    return res.status(500).json({ error: "Matching failed" });
  }
}
