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
