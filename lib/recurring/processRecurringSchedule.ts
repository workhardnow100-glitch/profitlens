// lib/recurring/processRecurringSchedule.ts
// PURPOSE:
// This module executes a single recurring invoice schedule. It is called when:
//   • The cron engine triggers a schedule
//   • The user presses “Run Now” in the UI
//
// WHAT IT DOES:
//   1. Calls createInvoiceFromSchedule(schedule)
//        → This is where the invoice is actually created.
//        → This is where line items, VAT, totals, and MONEY FORMAT are applied.
//        → This is where pence vs pounds MUST be correct.
//   2. Inserts a run log entry (success or error)
//   3. Computes the next run date based on frequency + interval
//   4. Updates the schedule (next_run_date, last_run_date, processing flag)
//
// MONEY MODEL:
//   • This file DOES NOT perform any money conversion.
//   • It assumes schedule.template_line_items.unit_price is already in PENCE.
//   • It assumes createInvoiceFromSchedule returns an invoice whose amounts
//     (net_amount, tax_amount, gross_amount) are also in PENCE.
//   • PDF + Email generators divide by 100 to show pounds.
//
// NEXT FILE TO AUDIT:
//   → lib/invoices/createInvoiceFromSchedule.ts
//   This is where the money mismatch is happening.
//   This is where we will fix the pounds→pence conversion for recurring invoices.

import { supabaseAdmin } from "../supabase-admin";
import { createInvoiceFromSchedule } from "../invoices/createInvoiceFromSchedule";

function computeNextRunDate(schedule: any): string {
  const current = new Date(schedule.next_run_date);

  switch (schedule.frequency_type) {
    case "daily":
      current.setDate(current.getDate() + schedule.interval);
      break;
    case "weekly":
      current.setDate(current.getDate() + 7 * schedule.interval);
      break;
    case "monthly":
      current.setMonth(current.getMonth() + schedule.interval);
      break;
    case "yearly":
      current.setFullYear(current.getFullYear() + schedule.interval);
      break;
    default:
      throw new Error(`Unknown frequency type: ${schedule.frequency_type}`);
  }

  return current.toISOString().slice(0, 10);
}

export async function processRecurringSchedule(schedule: any) {
  const today = new Date().toISOString().slice(0, 10);

  try {
    // ⭐ CRITICAL: This is where invoice totals are created.
    // If money is wrong, the bug is inside createInvoiceFromSchedule.
    const invoice = await createInvoiceFromSchedule(schedule);

    await supabaseAdmin.from("recurring_invoice_runs").insert([
      {
        recurring_invoice_id: schedule.id,
        user_id: schedule.user_id,
        invoice_id: invoice.id,
        status: "success",
        run_at: new Date().toISOString(),
      },
    ]);

    const nextRun = computeNextRunDate(schedule);

    await supabaseAdmin
      .from("recurring_invoices")
      .update({
        processing: false,
        next_run_date: nextRun,
        last_run_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schedule.id);

    return invoice;
  } catch (err: any) {
    console.error("Recurring schedule failed:", err);

    await supabaseAdmin.from("recurring_invoice_runs").insert([
      {
        recurring_invoice_id: schedule.id,
        user_id: schedule.user_id,
        status: "error",
        error_message: err?.message || String(err),
        run_at: new Date().toISOString(),
      },
    ]);

    await supabaseAdmin
      .from("recurring_invoices")
      .update({ processing: false })
      .eq("id", schedule.id);

    throw err;
  }
}
