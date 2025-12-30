import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import Stripe from "stripe";

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {});

// Disable Next.js body parsing for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read raw body
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["stripe-signature"] as string;

    event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // -----------------------------
  // HANDLE EVENTS
  // -----------------------------
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const invoiceId = session.metadata?.invoice_id;
        const userId = session.metadata?.user_id;

        if (!invoiceId || !userId) {
          console.error("Missing metadata on session");
          break;
        }

        // Fetch invoice
        const { data: invoice } = await supabaseAdmin
          .from("invoices")
          .select("*")
          .eq("id", invoiceId)
          .single();

        if (!invoice) {
          console.error("Invoice not found for webhook");
          break;
        }

        const amountPaid = session.amount_total
          ? session.amount_total / 100
          : Number(invoice.gross_amount);

        // 1. Mark invoice as paid
        await supabaseAdmin
          .from("invoices")
          .update({
            payment_status: "paid",
            status: "paid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);

        // 2. Create transaction entry
        // IMPORTANT:
        // Transactions belong to the BUSINESS (user), not the external client.
        const { data: transaction, error: txError } = await supabaseAdmin
          .from("transactions")
          .insert({
            user_id: userId,
            client_id: userId, // ProfitLens business owner — NOT external client
            amount: amountPaid,
            type: "income",
            description: `Invoice ${invoice.invoice_number} payment`,
            date: new Date().toISOString(),
            includedinct: true,
            includedinsa: true,
            includedinvat: true,
          })
          .select()
          .single();

        if (txError) {
          console.error("Failed to create transaction:", txError);
          break;
        }

        // 3. Create invoice_payments entry
        await supabaseAdmin.from("invoice_payments").insert({
          invoice_id: invoiceId,
          transaction_id: transaction.id,
          amount: amountPaid,
          match_confidence: "high",
          source: "auto",
        });

        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = intent.metadata?.invoice_id;

        if (invoiceId) {
          await supabaseAdmin
            .from("invoices")
            .update({
              payment_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoiceId);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
