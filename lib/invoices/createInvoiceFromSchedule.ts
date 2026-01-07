import { supabaseAdmin } from "../supabase-admin";
import { sendInvoiceEmail } from "../emails/sendInvoiceEmail";

export async function createInvoiceFromSchedule(schedule: any) {
  const {
    user_id,
    client_id,
    template_line_items,
    template_payment_instructions,
    template_notes,
    id: scheduleId,
  } = schedule;

  const now = new Date().toISOString();

  // ⭐ 1. Validate client exists + subscription
  const { data: client, error: clientErr } = await supabaseAdmin
    .from("clients")
    .select("id, subscription_status")
    .eq("id", client_id)
    .single();

  if (clientErr || !client) {
    throw new Error("Client not found for recurring invoice");
  }

  const isSubscribed = ["basic", "pro", "trialing"].includes(
    client.subscription_status
  );

  if (!isSubscribed) {
    throw new Error("Client subscription inactive — cannot generate invoice");
  }

  // ⭐ 2. Validate line items
  if (!Array.isArray(template_line_items) || template_line_items.length === 0) {
    throw new Error("Invalid or empty line items in schedule");
  }

  for (const item of template_line_items) {
    if (
      typeof item.quantity !== "number" ||
      typeof item.unit_price !== "number" ||
      item.quantity < 0 ||
      item.unit_price < 0
    ) {
      throw new Error("Invalid line item values");
    }
  }

  // ⭐ 3. Compute total safely
  const total = computeTotalFromLineItems(template_line_items);

  // ⭐ 4. Create invoice
  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .insert({
      user_id,
      client_id,
      line_items: template_line_items,
      payment_instructions: template_payment_instructions,
      notes: template_notes,
      total,
      status: "sent",
      created_from_schedule_id: scheduleId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating invoice from schedule:", error);
    throw new Error("Failed to create invoice from schedule");
  }

  // ⭐ 5. Load customer
  const { data: customer } = await supabaseAdmin
    .from("external_clients")
    .select("*")
    .eq("id", client_id)
    .maybeSingle();

  // ⭐ 6. Load business owner
  const { data: owner } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", user_id)
    .maybeSingle();

  // ⭐ 7. Send invoice email
  try {
    await sendInvoiceEmail({
      invoice,
      customer,
      owner,
    });
  } catch (emailErr) {
    console.error("Error sending recurring invoice email:", emailErr);

    // Mark invoice as email_failed
    await supabaseAdmin
      .from("invoices")
      .update({ email_status: "failed", updated_at: now })
      .eq("id", invoice.id);

    // Do NOT throw — invoice creation succeeded
  }

  return invoice;
}

function computeTotalFromLineItems(items: any[]) {
  if (!items) return 0;
  return items.reduce((sum, item) => {
    const net = item.quantity * item.unit_price;
    const vat = (net * (item.vat_rate || 0)) / 100;
    return sum + net + vat;
  }, 0);
}
 