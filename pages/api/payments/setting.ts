// pages/api/payments/settings.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
// import stripe from "../../../lib/stripe"; // your Stripe client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorised" });

  // TODO: load stripe_account_id + settings from your DB
  // TODO: call Stripe to get account + payout info
  // TODO: load platform fee + payment methods + webhook health

  const response = {
    stripeAccountId: null,
    stripeStatus: "not_connected",
    payoutsEnabled: false,
    bankLast4: null,
    bankSortCode: null,
    payoutSchedule: null,
    nextPayoutDate: null,
    lastPayoutAmount: null,
    lastPayoutDate: null,
    platformFeePercent: null,
    platformFeeMin: null,
    platformFeeMax: null,
    paymentMethods: {
      card: true,
      applePay: true,
      googlePay: true,
      bankTransfer: true,
      payByLink: true,
    },
    webhook: {
      lastEventAt: null,
      lastErrorAt: null,
      errorCount: 0,
    },
  };

  return res.status(200).json(response);
}
