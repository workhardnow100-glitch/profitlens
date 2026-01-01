import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { prisma } from "../../../lib/prisma";

// Stripe client (no apiVersion override)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

type RadarResponse = {
  charges: any[];
  payouts: any[];
  balance: any[];
  matches: any[];
  unmatched: any[];
};

// Safe JSON fallback for metadata
function safeJson(input: any): any {
  if (!input || typeof input !== "object") return {};
  try {
    JSON.stringify(input);
    return input;
  } catch {
    return {};
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RadarResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [chargesList, payoutsList, balanceList] = await Promise.all([
      stripe.charges.list({ limit: 100 }),
      stripe.payouts.list({ limit: 100 }),
      stripe.balanceTransactions.list({ limit: 100 }),
    ]);

    // Charges
    const chargeMap: Record<string, any> = {};
    for (const ch of chargesList.data) {
      const amountGross = ch.amount;
      const amountFee = (ch.balance_transaction as any)?.fee ?? 0;
      const amountNet = (ch.balance_transaction as any)?.net ?? amountGross - amountFee;

      const pc = await prisma.paymentCharge.upsert({
        where: { stripeChargeId: ch.id },
        create: {
          stripeChargeId: ch.id,
          stripePaymentIntentId: ch.payment_intent as string | null,
          stripeCustomerId: ch.customer as string | null,
          currency: ch.currency.toUpperCase(),
          amountGross,
          amountFee,
          amountNet,
          status: ch.status,
          description: ch.description ?? null,
          failureCode: ch.failure_code ?? null,
          failureMessage: ch.failure_message ?? null,
          userId: null,
          clientId: null,
          invoiceId: null,
          source: ch.metadata?.source ?? null,
          reference: ch.metadata?.invoice_number ?? ch.metadata?.reference ?? null,
          email: ch.billing_details?.email ?? null,
          metadata: safeJson(ch.metadata),
        },
        update: {
          stripePaymentIntentId: ch.payment_intent as string | null,
          stripeCustomerId: ch.customer as string | null,
          currency: ch.currency.toUpperCase(),
          amountGross,
          amountFee,
          amountNet,
          status: ch.status,
          description: ch.description ?? null,
          failureCode: ch.failure_code ?? null,
          failureMessage: ch.failure_message ?? null,
          source: ch.metadata?.source ?? null,
          reference: ch.metadata?.invoice_number ?? ch.metadata?.reference ?? null,
          email: ch.billing_details?.email ?? null,
          metadata: safeJson(ch.metadata),
        },
      });

      chargeMap[pc.id] = pc;
    }

    // Payouts
    const payoutMap: Record<string, any> = {};
    for (const po of payoutsList.data) {
      const pp = await prisma.paymentPayout.upsert({
        where: { stripePayoutId: po.id },
        create: {
          stripePayoutId: po.id,
          stripeBalanceTransactionId: po.balance_transaction as string | null,
          currency: po.currency.toUpperCase(),
          amount: po.amount,
          arrivalDate: po.arrival_date ? new Date(po.arrival_date * 1000) : null,
          status: po.status,
          userId: null,
          metadata: safeJson(po.metadata),
        },
        update: {
          stripeBalanceTransactionId: po.balance_transaction as string | null,
          currency: po.currency.toUpperCase(),
          amount: po.amount,
          arrivalDate: po.arrival_date ? new Date(po.arrival_date * 1000) : null,
          status: po.status,
          metadata: safeJson(po.metadata),
        },
      });

      payoutMap[pp.id] = pp;
    }

    // Balance transactions
    const balanceItems: any[] = [];
for (const bt of balanceList.data) {
  const bi = await prisma.paymentBalanceItem.upsert({
    where: { stripeBalanceTransactionId: bt.id },
    create: {
      stripeBalanceTransactionId: bt.id,
      stripeType: bt.type,
      currency: bt.currency.toUpperCase(),
      amount: bt.amount,
      fee: bt.fee ?? null,
      net: bt.net ?? null,
      chargeId: null,
      payoutId: null,
      userId: null,
      // ❌ metadata removed — not present on BalanceTransaction
    },
    update: {
      stripeType: bt.type,
      currency: bt.currency.toUpperCase(),
      amount: bt.amount,
      fee: bt.fee ?? null,
      net: bt.net ?? null,
      // ❌ metadata removed
    },
  });

  balanceItems.push(bi);
}


    // Matching engine (stubbed)
    const matches: any[] = [];
    const unmatched: any[] = [];

    for (const chargeId in chargeMap) {
      const charge = chargeMap[chargeId];
      unmatched.push(charge);
    }

    return res.status(200).json({
      charges: Object.values(chargeMap),
      payouts: Object.values(payoutMap),
      balance: balanceItems,
      matches,
      unmatched,
    });
  } catch (err: any) {
    console.error("Payments Radar error:", err);
    return res.status(500).json({ error: "Failed to load payments radar" });
  }
}
