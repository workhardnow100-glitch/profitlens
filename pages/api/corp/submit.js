// pages/api/corp/submit.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // ✅ 1. Fetch Corporation Tax transactions
    const { data: corpTxs, error: fetchError } = await supabase
      .from("transactions")
      .select("id, date, category, amount, tax_locked")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    if (!corpTxs || corpTxs.length === 0) {
      return res.status(400).json({
        error: "No Corporation Tax transactions found for this period."
      });
    }

    // ✅ 2. Compute profit before tax
    let income = 0;
    let expenses = 0;

    corpTxs.forEach((tx) => {
      if (tx.category === "income") {
        income += Number(tx.amount || 0);
      }
      if (tx.category === "expense") {
        expenses += Number(tx.amount || 0);
      }
    });

    const profitBeforeTax = income - expenses;

    // ✅ 3. Compute Corporation Tax due
    const corpTaxRate = 0.19; // 19% for now
    const corpTaxDue = profitBeforeTax > 0 ? profitBeforeTax * corpTaxRate : 0;

    // ✅ 4. Lock all CT transactions in this period
    const { error: lockError } = await supabase
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (lockError) throw new Error(lockError.message);

    // ✅ 5. Insert CT submission record
    const { data: submission, error: insertError } = await supabase
      .from("corp_submissions")
      .insert([
        {
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          profit_before_tax: profitBeforeTax,
          corp_tax_due: corpTaxDue,
          effective_rate:
            profitBeforeTax > 0 ? (corpTaxDue / profitBeforeTax) * 100 : 0,
          hmrc_response: {
            status: "SUCCESS",
            processingDate: new Date().toISOString(),
            message: "Corporation Tax return accepted (simulated HMRC response)"
          }
        }
      ])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    // ✅ 6. Return HMRC-style response
    return res.status(200).json({
      success: true,
      hmrcResponse: submission.hmrc_response,
      profitBeforeTax,
      corpTaxDue,
      effectiveRate:
        profitBeforeTax > 0 ? (corpTaxDue / profitBeforeTax) * 100 : 0
    });

  } catch (err) {
    console.error("Corporation Tax submission error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
