// pages/api/forms/ct600/supplements.js
import prisma from "../../../../lib/prisma";

export default async function handler(req, res) {
  try {
    const { clientId, periodStart, periodEnd } = req.query;

    if (!clientId || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Missing clientId, periodStart, or periodEnd.",
      });
    }

    // ────────────────────────────────────────────────
    // 1. LOAD ALL JOURNALS FOR THE PERIOD
    // ────────────────────────────────────────────────
    const journals = await prisma.journal.findMany({
      where: {
        clientId,
        date: {
          gte: new Date(periodStart),
          lte: new Date(periodEnd),
        },
      },
      include: {
        lines: true,
      },
    });

    // Helper: sum by account code prefix
    const sumByPrefix = (prefix) =>
      journals
        .flatMap((j) => j.lines)
        .filter((l) => l.accountCode?.startsWith(prefix))
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    // ────────────────────────────────────────────────
    // 2. DETECT SUPPLEMENTS
    // ────────────────────────────────────────────────

    // CT600A — Loans to Participators
    const dlaBalance = sumByPrefix("DLA"); // director loan account
    const ct600ARequired = Math.abs(dlaBalance) > 0;

    // CT600L — R&D
    const rAndDSpend = sumByPrefix("RD"); // your R&D expense prefix
    const ct600LRequired = rAndDSpend > 0;

    // CT600J — DOTAS
    const dotasEntries = journals.some((j) =>
      j.lines.some((l) => l.accountCode === "DOTAS")
    );
    const ct600JRequired = dotasEntries;

    // CT600F — Charity
    const charityIncome = sumByPrefix("CHAR");
    const ct600FRequired = charityIncome > 0;

    // CT600M — Cross-border royalties
    const royaltyPayments = sumByPrefix("ROY");
    const ct600MRequired = royaltyPayments > 0;

    // CT600N — Northern Ireland rate
    const niTrading = sumByPrefix("NI");
    const ct600NRequired = niTrading > 0;

    // ────────────────────────────────────────────────
    // 3. RETURN RESULT
    // ────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      supplements: {
        ct600ARequired,
        ct600JRequired,
        ct600LRequired,
        ct600FRequired,
        ct600MRequired,
        ct600NRequired,
      },
    });
  } catch (err) {
    console.error("CT600 supplement detection failed:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error detecting CT600 supplements.",
    });
  }
}
