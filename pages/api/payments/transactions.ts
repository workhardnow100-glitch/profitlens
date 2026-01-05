import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const actingAsClientId = (session.user as any).actingAsClientId || null;
  const baseClientId = (session.user as any).clientId || null;
  const activeClientId = actingAsClientId || baseClientId;

  if (!activeClientId) {
    return res.status(400).json({ error: "No active client selected" });
  }

  try {
    // ============================================================
    // 1. FETCH CHARGES FOR THIS CLIENT
    // ============================================================
    const { data: charges, error: chargesError } = await supabaseAdmin
      .from("payment_charges")
      .select("*")
      .eq("client_id", activeClientId)
      .order("created_at", { ascending: false });

    if (chargesError) {
      console.error("chargesError", chargesError);
      return res.status(500).json({ error: "Failed to load charges" });
    }

    const chargeIds = (charges || []).map((c) => c.id);

    // ============================================================
    // 2. FETCH BALANCE ITEMS (fees, net, adjustments)
    // ============================================================
    const { data: balanceItems, error: balanceError } = await supabaseAdmin
      .from("payment_balance_items")
      .select("*")
      .in("charge_id", chargeIds.length ? chargeIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });

    if (balanceError) {
      console.error("balanceError", balanceError);
      return res.status(500).json({ error: "Failed to load balance items" });
    }

    // ============================================================
    // 3. FETCH MATCHES (invoice matching intelligence)
    // ============================================================
    const { data: matches, error: matchesError } = await supabaseAdmin
      .from("payment_matches")
      .select("*")
      .in("charge_id", chargeIds.length ? chargeIds : ["00000000-0000-0000-0000-000000000000"]);

    if (matchesError) {
      console.error("matchesError", matchesError);
      return res.status(500).json({ error: "Failed to load matches" });
    }

    const matchMap = new Map((matches || []).map((m: any) => [m.charge_id, m]));

    // ============================================================
    // 4. FETCH INVOICES FOR THIS CLIENT
    // ============================================================
    const { data: invoices, error: invoicesError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("client_id", activeClientId);

    if (invoicesError) {
      console.error("invoicesError", invoicesError);
      return res.status(500).json({ error: "Failed to load invoices" });
    }

    const invoiceMap = new Map((invoices || []).map((inv: any) => [inv.id, inv]));

    // ============================================================
    // 5. FETCH EXTERNAL CLIENT (for name/email/address)
    // ============================================================
    const { data: externalClient } = await supabaseAdmin
      .from("external_clients")
      .select("*")
      .eq("id", activeClientId)
      .single();

    // ============================================================
    // 6. FETCH PAYOUTS FOR THIS CLIENT
    // ============================================================
    const { data: payouts, error: payoutError } = await supabaseAdmin
      .from("payment_payouts")
      .select("*")
      .eq("user_id", session.user.id) // payouts are linked to user, not client
      .order("created_at", { ascending: false });

    if (payoutError) {
      console.error("payoutError", payoutError);
      return res.status(500).json({ error: "Failed to load payouts" });
    }

    const payoutIds = (payouts || []).map((p) => p.id);

    // ============================================================
    // 7. FETCH PAYOUT ITEMS (charge → payout mapping)
    // ============================================================
    const { data: payoutItems, error: payoutItemsError } = await supabaseAdmin
      .from("payment_payout_items")
      .select("*")
      .in("payout_id", payoutIds.length ? payoutIds : ["00000000-0000-0000-0000-000000000000"]);

    if (payoutItemsError) {
      console.error("payoutItemsError", payoutItemsError);
      return res.status(500).json({ error: "Failed to load payout items" });
    }

    const payoutItemsByCharge = new Map<string, any[]>();
    (payoutItems || []).forEach((pi: any) => {
      if (!pi.charge_id) return;
      if (!payoutItemsByCharge.has(pi.charge_id)) payoutItemsByCharge.set(pi.charge_id, []);
      payoutItemsByCharge.get(pi.charge_id)!.push(pi);
    });

    // ============================================================
    // 8. BUILD UNIFIED LEDGER
    // ============================================================
    const balanceByCharge = new Map<string, any[]>();
    (balanceItems || []).forEach((b: any) => {
      if (!b.charge_id) return;
      if (!balanceByCharge.has(b.charge_id)) balanceByCharge.set(b.charge_id, []);
      balanceByCharge.get(b.charge_id)!.push(b);
    });

    const unified = (charges || []).map((charge: any) => {
      const relatedBalance = balanceByCharge.get(charge.id) || [];
      const match = matchMap.get(charge.id) || null;
      const invoice = charge.invoice_id ? invoiceMap.get(charge.invoice_id) : null;
      const payoutLinks = payoutItemsByCharge.get(charge.id) || [];

      const netFromBalance =
        relatedBalance.reduce((sum: number, b: any) => sum + (b.net ?? b.amount ?? 0), 0) ||
        charge.amount_net;

      return {
        id: charge.id,
        type: "charge",
        amount: netFromBalance / 100,
        currency: charge.currency || "GBP",
        createdAt: charge.created_at,

        clientName:
          externalClient?.business_name ||
          externalClient?.trading_name ||
          externalClient?.contact_name ||
          charge.email ||
          null,
        clientEmail: charge.email || externalClient?.contact_email || null,
        clientAddress: externalClient?.address_line1 || null,

        invoiceId: invoice?.id || null,
        invoiceNumber: invoice?.invoice_number || null,
        invoiceStatus: invoice?.status || null,

        confidence: match?.confidence ?? null,
        payoutItems: payoutLinks,
        metadata: charge.metadata || {},
      };
    });

    // ============================================================
    // 9. ADD PAYOUTS AS LEDGER ENTRIES
    // ============================================================
    const payoutEntries = (payouts || []).map((p: any) => ({
      id: p.id,
      type: "payout",
      amount: -(p.amount / 100), // payouts are money leaving Stripe
      currency: p.currency,
      createdAt: p.created_at,
      clientName: externalClient?.business_name || null,
      clientEmail: externalClient?.contact_email || null,
      clientAddress: externalClient?.address_line1 || null,
      invoiceId: null,
      invoiceNumber: null,
      invoiceStatus: null,
      confidence: null,
      payoutItems: payoutItems.filter((pi: any) => pi.payout_id === p.id),
      metadata: p.metadata || {},
    }));

    // ============================================================
    // 10. MERGE + SORT
    // ============================================================
    const finalLedger = [...unified, ...payoutEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.status(200).json({ transactions: finalLedger });
  } catch (err: any) {
    console.error("TRANSACTIONS API ERROR:", err);
    return res.status(500).json({
      error: "Failed to load transactions",
      details: err.message,
    });
  }
}
