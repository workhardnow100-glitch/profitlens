import { supabaseAdmin } from "../supabase-admin";
import { createInvoiceFromSchedule } from "../invoices/createInvoiceFromSchedule";

// -------------------------------------------------------------
// Advance next_run_date based on frequency
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// MAIN PROCESSOR
// -------------------------------------------------------------
export async function processRecurringSchedule(schedule: any) {
  const today = new Date().toISOString().slice(0, 10);

  try {
    // 1. Create the real invoice
    const invoice = await createInvoiceFromSchedule(schedule);

    // 2. Log run
    await supabaseAdmin.from("recurring_invoice_runs").insert([
      {
        recurring_invoice_id: schedule.id,
        user_id: schedule.user_id,
        invoice_id: invoice.id,
        status: "success",
        run_at: new Date().toISOString(),
      },
    ]);

    // 3. Compute next run date
    const nextRun = computeNextRunDate(schedule);

    // 4. Update schedule (unlock + next_run_date)
    await supabaseAdmin
      .from("recurring_invoices")
      .update({
        processing: false,
        next_run_date: nextRun,
        last_run_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schedule.id);

  } catch (err: any) {
    console.error("Recurring schedule failed:", err);

    // Log failure
    await supabaseAdmin.from("recurring_invoice_runs").insert([
      {
        recurring_invoice_id: schedule.id,
        user_id: schedule.user_id,
        status: "error",
        error_message: err?.message || String(err),
        run_at: new Date().toISOString(),
      },
    ]);

    // Unlock schedule
    await supabaseAdmin
      .from("recurring_invoices")
      .update({ processing: false })
      .eq("id", schedule.id);

    throw err;
  }
}
