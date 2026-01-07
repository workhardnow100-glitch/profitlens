// pages/api/payments/payout/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { requireRole } from "../../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Only the FOUNDER can view payout drilldowns
  const guard = await requireRole(req, res, ["FOUNDER"]);
  if (!guard.ok) return;

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing or invalid payout ID" });
  }

  try {
    // 1. Fetch payout
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from("payment_payouts")
      .select(
        `
        id,
        amount,
        net,
        fee,
        status,
        arrival_date,
        created_at,
        currency,
        stripe_payout_id
      `
      )
      .eq("id", id)
      .single();

    if (payoutError || !payout) {
      console.error("Payout fetch error:", payoutError);
      return res.status(404).json({ error: "Payout not found" });
    }

    // 2. Fetch payout items
    const { data: payoutItems, error: itemsError } = await supabaseAdmin
      .from("payment_payout_items")
      .select("id, amount, charge_id, created_at")
      .eq("payout_id", id);

    if (itemsError) {
      console.error("Payout items error:", itemsError);
      return res.status(500).json({ error: "Failed to load payout items" });
    }

    // 3. Fetch balance items
    const { data: balanceItems, error: balanceError } = await supabaseAdmin
      .from("payment_balance_items")
      .select(
        "id, amount, fee, net, stripe_type, charge_id, created_at, metadata"
      )
      .eq("payout_id", id);

    if (balanceError) {
      console.error("Balance items error:", balanceError);
      return res.status(500).json({ error: "Failed to load balance items" });
    }

    // 4. Collect charge IDs
    const chargeIds = Array.from(
      new Set([
        ...payoutItems.map((i) => i.charge_id).filter(Boolean),
        ...balanceItems.map((i) => i.charge_id).filter(Boolean),
      ])
    );

    let charges: any[] = [];
    if (chargeIds.length > 0) {
      const { data: chargeData, error: chargeError } = await supabaseAdmin
        .from("payment_charges")
        .select(
          `
          id,
          stripe_charge_id,
          stripe_payment_intent_id,
          amount_gross,
          amount_fee,
          amount_net,
          currency,
          status,
          description,
          invoice_id,
          client_id,
          email,
          created_at
        `
        )
        .in("id", chargeIds);

      if (chargeError) {
        console.error("Charge fetch error:", chargeError);
        return res.status(500).json({ error: "Failed to load charges" });
      }

      charges = chargeData;
    }

    // 5. Return full drilldown
    return res.status(200).json({
      payout,
      payout_items: payoutItems,
      balance_items: balanceItems,
      charges,
    });
  } catch (err) {
    console.error("Payout drilldown API error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
