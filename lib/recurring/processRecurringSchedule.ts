import { supabaseAdmin } from "../supabase-admin";
import { createInvoiceFromSchedule } from "../invoices/createInvoiceFromSchedule";

export async function processRecurringSchedule(schedule: any) {
  const { id: scheduleId, user_id, client_id, frequency_type, interval, next_run_date } = schedule;

  // 1. Create invoice from schedule
  const invoice = await createInvoiceFromSchedule(schedule);

  // 2. Log run history
  const now = new Date().toISOString();
  await supabaseAdmin.from("recurring_invoice_runs").insert({
    recurring_invoice_id: scheduleId,
    user_id,
    invoice_id: invoice.id,
    run_at: now,
    status: "success",
    error_message: null,
  });

  // 3. Compute next_run_date
  const nextRun = computeNextRunDate(next_run_date, frequency_type, interval);

  // 4. Update schedule
  await supabaseAdmin
    .from("recurring_invoices")
    .update({
      next_run_date: nextRun,
      updated_at: now,
    })
    .eq("id", scheduleId)
    .eq("user_id", user_id);
}

function computeNextRunDate(current: string, frequencyType: string, interval: number) {
  const d = new Date(current);

  if (frequencyType === "daily") {
    d.setDate(d.getDate() + interval);
  } else if (frequencyType === "weekly") {
    d.setDate(d.getDate() + 7 * interval);
  } else if (frequencyType === "monthly") {
    d.setMonth(d.getMonth() + interval);
  }

  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
