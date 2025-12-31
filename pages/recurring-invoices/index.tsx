// pages/api/recurring-invoices/run.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabase-admin";

// Optional: protect with a secret token in headers/query if exposed publicly.

function addInterval(
  dateStr: string,
  frequencyType: string,
  interval: number
): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  if (frequencyType === "daily") {
    d.setDate(d.getDate() + interval);
  } else if (frequencyType === "weekly") {
    d.setDate(d.getDate() + 7 * interval);
  } else if (frequencyType === "monthly") {
    d.setMonth(d.getMonth() + interval);
  } else if (frequencyType === "yearly") {
    d.setFullYear(d.getFullYear() + interval);
  } else {
    // custom: for now, treat like monthly; can be extended later
    d.setMonth(d.getMonth() + interval);
  }

  return d.toISOString().slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const { data: schedules, error: schedError } = await supabaseAdmin
      .from("recurring_invoices")
      .select("*")
      .eq("active", true)
      .lte("next_run_date", today);

    if (schedError) {
      console.error(schedError);
      return res.status(500).json({ error: "Failed to fetch schedules" });
    }

    if (!schedules || schedules.length === 0) {
      return res.status(200).json({ generated: 0, details: [] });
    }

    const results: any[] = [];

    for (const sched of schedules) {
      try {
        // Generate invoice from template
        const { data: invoice, error: invError } = await supabaseAdmin
          .from("invoices")
          .insert({
            user_id: sched.user_id,
            client_id: sched.client_id,
            // You can refine these fields to match your schema exactly
            invoice_number: null, // let your existing logic auto-generate if needed
            issue_date: today,
            due_date: today,
            payment_terms: "Generated from recurring schedule",
            payment_instructions: sched.template_payment_instructions,
            notes_to_client: sched.template_notes,
            status: "draft",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (invError || !invoice) throw invError;

        // Insert line items
        if (Array.isArray(sched.template_line_items)) {
          const lineItemsPayload = sched.template_line_items.map((li: any, idx: number) => ({
            invoice_id: invoice.id,
            description: li.description,
            quantity: li.quantity,
            unit_price: li.unit_price,
            vat_rate: li.vat_rate,
            position: idx,
          }));

          const { error: liError } = await supabaseAdmin
            .from("invoice_line_items")
            .insert(lineItemsPayload);

          if (liError) throw liError;
        }

        // Compute next_run_date
        const nextRun = addInterval(
          sched.next_run_date || sched.start_date,
          sched.frequency_type,
          sched.interval || 1
        );

        const { error: updError } = await supabaseAdmin
          .from("recurring_invoices")
          .update({
            next_run_date: nextRun,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sched.id);

        if (updError) throw updError;

        results.push({
          scheduleId: sched.id,
          invoiceId: invoice.id,
          success: true,
        });
      } catch (err: any) {
        console.error("Failed to generate from schedule", sched.id, err);
        results.push({
          scheduleId: sched.id,
          success: false,
          message: err?.message || "Failed to generate invoice",
        });
      }
    }

    return res.status(200).json({
      generated: results.filter((r) => r.success).length,
      details: results,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
