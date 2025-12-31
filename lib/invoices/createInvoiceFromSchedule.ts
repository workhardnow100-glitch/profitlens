import { supabaseAdmin } from "../supabase-admin";
import { sendInvoiceEmail } from "../emails/sendInvoiceEmail"; 
// ^^^ Adjust this import to match your actual email sender path

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

  // Compute totals however your invoice system does it
  const total = computeTotalFromLineItems(template_line_items);

  // 1. Create invoice
  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .insert({
      user_id,
      client_id,
      line_items: template_line_items,
      payment_instructions: template_payment_instructions,
      notes: template_notes,
      total,
      status: "sent", // or "pending" if you want manual review
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

  // 2. Load customer
  const { data: customer, error: customerError } = await supabaseAdmin
    .from("external_clients")
    .select("*")
    .eq("id", client_id)
    .maybeSingle();

  if (customerError) {
    console.error("Error loading customer:", customerError);
  }

  // 3. Load business owner
  const { data: owner, error: ownerError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", user_id)
    .maybeSingle();

  if (ownerError) {
    console.error("Error loading business owner:", ownerError);
  }

  // 4. Send invoice email (Step 5 complete)
  try {
    await sendInvoiceEmail({
      invoice,
      customer,
      owner,
    });
  } catch (emailErr) {
    console.error("Error sending recurring invoice email:", emailErr);
    // We do NOT throw here — invoice creation succeeded.
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
