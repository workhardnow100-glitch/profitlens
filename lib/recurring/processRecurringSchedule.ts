import { supabaseAdmin } from "../supabase-admin";
import { createInvoiceFromSchedule } from "../invoices/createInvoiceFromSchedule";

export async function processRecurringSchedule(schedule: any) {
  const {
    id: scheduleId,
    user_id,
    client_id,
    frequency_type,
    interval,
    next_run_date,
  } = schedule;

  const now = new Date().toISOString();

  // ⭐ 1. Validate schedule fields
  if (!client_id || !user_id || !frequency_type || !interval || !next_run_date) {
    await logFailure(scheduleId, client_id, user_id, "Invalid schedule fields");
    return;
  }

  // ⭐ 2. Validate EXTERNAL client exists
  const { data: extClient, error: extErr } = await supabaseAdmin
    .from("external_clients")
    .select("id")
    .eq("id", client_id)
    .single();

  if (extErr || !extClient) {
    await logFailure(scheduleId, client_id, user_id, "External client not found");
    return;
  }

  // ⭐ 3. Validate BUSINESS OWNER exists (correct column: owner_id)
  const { data: business, error: businessErr } = await supabaseAdmin
    .from("clients")
    .select("id, subscription_status")
    .eq("owner_id", user_id)
    .single();

  if (businessErr || !business) {
    await logFailure(scheduleId, client_id, user_id, "Business owner not found");
    return;
  }

  // ⭐ 4. Validate subscription
  const isSubscribed = ["basic", "pro", "trialing"].includes(
    business.subscription_status
  );

  if (!isSubscribed) {
    await logFailure(scheduleId, client_id, user_id, "Business not subscribed");
    return;
  }

  // ⭐ 5. Create invoice
  let invoice;
  try {
    invoice = await createInvoiceFromSchedule(schedule);
  } catch (err: any) {
    await logFailure(
      scheduleId,
      client_id,
      user_id,
      `Invoice creation failed: ${err?.message || err}`
    );
    return;
  }

  // ⭐ 6. Log successful run
  await supabaseAdmin.from("recurring_invoice_runs").insert({
    recurring_invoice_id: scheduleId,
    user_id,
    invoice_id: invoice.id,
    run_at: now,
    status: "success",
    error_message: null,
  });

  // ⭐ 7. Compute next run date
  const nextRun = safeComputeNextRunDate(
    next_run_date,
    frequency_type,
    interval
  );

  // ⭐ 8. Update schedule
  await supabaseAdmin
    .from("recurring_invoices")
    .update({
      next_run_date: nextRun,
      updated_at: now,
      processing: false,
    })
    .eq("id", scheduleId);
}

async function logFailure(
  scheduleId: string,
  clientId: string,
  userId: string,
  message: string
) {
  const now = new Date().toISOString();

  await supabaseAdmin.from("recurring_invoice_runs").insert({
    recurring_invoice_id: scheduleId,
    user_id: userId,
    invoice_id: null,
    run_at: now,
    status: "error",
    error_message: message,
  });

  await supabaseAdmin.from("audit").insert([
    {
      client_id: clientId,
      user_id: userId,
      action: "RECURRING_INVOICE_ERROR",
      details: message,
      timestamp: now,
    },
  ]);

  await supabaseAdmin
    .from("recurring_invoices")
    .update({ processing: false })
    .eq("id", scheduleId);
}

function safeComputeNextRunDate(
  current: string,
  frequencyType: string,
  interval: number
) {
  const d = new Date(current);
  if (isNaN(d.getTime())) return current;

  switch (frequencyType) {
    case "daily":
      d.setDate(d.getDate() + interval);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7 * interval);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + interval);
      break;
    default:
      return current;
  }

  return d.toISOString().slice(0, 10);
}
