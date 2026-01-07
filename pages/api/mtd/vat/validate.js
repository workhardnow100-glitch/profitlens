// pages/api/mtd/vat/validate.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { createClient } from "../../../../lib/mtd-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ Validate session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );
  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant‑aware client ID (strict)
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  const { periodStart, periodEnd } = req.body || {};

  if (!periodStart || !periodEnd) {
    return res.status(400).json({
      error: "Missing required fields: periodStart, periodEnd",
    });
  }

  // ⭐ Accountant period-range sanity check
  if (role === "ACCOUNTANT") {
    const startYear = Number(periodStart.split("-")[0]);
    const endYear = Number(periodEnd.split("-")[0]);

    if (
      Number.isNaN(startYear) ||
      Number.isNaN(endYear) ||
      startYear < 2000 ||
      endYear > 2100 ||
      endYear < startYear
    ) {
      return res.status(400).json({ error: "Invalid period range" });
    }
  }

  try {
    // ⭐ AUDIT LOG — Accountant validating VAT MTD period
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VALIDATE_VAT_MTD_PERIOD",
          details: `Validated VAT MTD period ${periodStart} → ${periodEnd}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ---------------------------------------------------------
    // 1. Fetch VAT transactions
    // ---------------------------------------------------------
    const { data: vatTxs, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, business_category, vat_amount, tax_locked, date")
      .eq("client_id", clientId)
      .not("vat_amount", "is", null)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (txError) throw txError;

    if (!vatTxs || vatTxs.length === 0) {
      return res
        .status(400)
        .json({ error: "No VAT transactions found in this period" });
    }

    // ---------------------------------------------------------
    // 2. Recalculate totals
    // ---------------------------------------------------------
    let outputVat = 0;
    let inputVat = 0;

    vatTxs.forEach((tx) => {
      const vat = Number(tx.vat_amount || 0);
      const category = (tx.business_category || "").toLowerCase();

      if (category === "sales") {
        outputVat += vat;
      } else {
        inputVat += vat;
      }
    });

    const netVat = outputVat - inputVat;

    // ---------------------------------------------------------
    // 3. Fetch HMRC obligations → get real periodKey
    // ---------------------------------------------------------
    const mtd = await createClient(clientId);

    // ⭐ Guard: no MTD connection
    if (!mtd) {
      return res.status(400).json({ error: "MTD not connected" });
    }

    const obligations = await mtd.getVATObligations();

    if (!obligations?.obligations?.length) {
      return res.status(400).json({
        error: "No HMRC obligations found for this client",
      });
    }

    const match = obligations.obligations.find((o) => {
      return (
        o.start === periodStart &&
        o.end === periodEnd &&
        o.status === "O"
      );
    });

    if (!match) {
      return res.status(400).json({
        error:
          "No matching HMRC obligation found for this VAT period. Check HMRC portal.",
      });
    }

    const periodKey = match.periodKey;

    // ---------------------------------------------------------
    // 4. Insert validated submission with real periodKey
    // ---------------------------------------------------------
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("vat_mtd_submissions")
      .insert({
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
        output_vat: outputVat,
        input_vat: inputVat,
        net_vat: netVat,
        period_key: periodKey,
        status: "validated",
      })
      .select("id, period_key")
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      success: true,
      submissionId: insertData.id,
      periodKey: insertData.period_key,
      totals: {
        outputVat,
        inputVat,
        netVat,
      },
    });
  } catch (err) {
    console.error("VAT MTD validate error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
}
