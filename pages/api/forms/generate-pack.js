// pages/api/forms/generate-pack.js

import prisma from "../../../lib/prisma";
import { generateCt600Pdf } from "../../../lib/pdf/templates/ct600";
import { generateCt600aPdf } from "../../../lib/pdf/templates/ct600a";
import { generateCt600jPdf } from "../../../lib/pdf/templates/ct600j";
import { generateCt600lPdf } from "../../../lib/pdf/templates/ct600l";
import { generateCt600fPdf } from "../../../lib/pdf/templates/ct600f";
import { generateCt600mPdf } from "../../../lib/pdf/templates/ct600m";
import { generateCt600nPdf } from "../../../lib/pdf/templates/ct600n";

// NEW IMPORTS FOR iXBRL
import { computeCtForPeriod } from "../../../lib/ct/engine";
import { buildComputationsIxbrl } from "../../../lib/ixbrl/computationsBuilder";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { clientId, periodStart, periodEnd } = req.body;

    if (!clientId || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Missing clientId, periodStart, or periodEnd.",
      });
    }

    // ────────────────────────────────────────────────
    // 1. LOAD COMPANY DETAILS
    // ────────────────────────────────────────────────
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    // ────────────────────────────────────────────────
    // 2. DETECT SUPPLEMENTS
    // ────────────────────────────────────────────────
    const journals = await prisma.journal.findMany({
      where: {
        clientId,
        date: {
          gte: new Date(periodStart),
          lte: new Date(periodEnd),
        },
      },
      include: { lines: true },
    });

    const sumByPrefix = (prefix) =>
      journals
        .flatMap((j) => j.lines)
        .filter((l) => l.accountCode?.startsWith(prefix))
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    const supplements = {
      ct600ARequired: Math.abs(sumByPrefix("DLA")) > 0,
      ct600JRequired: journals.some((j) =>
        j.lines.some((l) => l.accountCode === "DOTAS")
      ),
      ct600LRequired: sumByPrefix("RD") > 0,
      ct600FRequired: sumByPrefix("CHAR") > 0,
      ct600MRequired: sumByPrefix("ROY") > 0,
      ct600NRequired: sumByPrefix("NI") > 0,
    };

    // ────────────────────────────────────────────────
    // 3. GENERATE FORMS (PDFs)
    // ────────────────────────────────────────────────
    const generated = [];

    await generateCt600Pdf({
      clientId,
      periodStart,
      periodEnd,
      year: new Date(periodEnd).getFullYear(),
      filename: `CT600_${clientId}_${periodEnd}.pdf`,
      createdBy: "system",
      companyDetails: client,
      supplements,
    });
    generated.push("CT600");

    if (supplements.ct600ARequired) {
      await generateCt600aPdf({
        clientId,
        periodStart,
        periodEnd,
        year: new Date(periodEnd).getFullYear(),
        filename: `CT600A_${clientId}_${periodEnd}.pdf`,
        createdBy: "system",
        companyDetails: client,
      });
      generated.push("CT600A");
    }

    if (supplements.ct600JRequired) {
      await generateCt600jPdf({
        clientId,
        periodStart,
        periodEnd,
        year: new Date(periodEnd).getFullYear(),
        filename: `CT600J_${clientId}_${periodEnd}.pdf`,
        createdBy: "system",
        companyDetails: client,
      });
      generated.push("CT600J");
    }

    if (supplements.ct600LRequired) {
      await generateCt600lPdf({
        clientId,
        periodStart,
        periodEnd,
        year: new Date(periodEnd).getFullYear(),
        filename: `CT600L_${clientId}_${periodEnd}.pdf`,
        createdBy: "system",
        companyDetails: client,
      });
      generated.push("CT600L");
    }

    if (supplements.ct600FRequired) {
      await generateCt600fPdf({
        clientId,
        periodStart,
        periodEnd,
        year: new Date(periodEnd).getFullYear(),
        filename: `CT600F_${clientId}_${periodEnd}.pdf`,
        createdBy: "system",
        companyDetails: client,
      });
      generated.push("CT600F");
    }

    if (supplements.ct600MRequired) {
      await generateCt600mPdf({
        clientId,
        periodStart,
        periodEnd,
        year: new Date(periodEnd).getFullYear(),
        filename: `CT600M_${clientId}_${periodEnd}.pdf`,
        createdBy: "system",
        companyDetails: client,
      });
      generated.push("CT600M");
    }

    if (supplements.ct600NRequired) {
      await generateCt600nPdf({
        clientId,
        periodStart,
        periodEnd,
        year: new Date(periodEnd).getFullYear(),
        filename: `CT600N_${clientId}_${periodEnd}.pdf`,
        createdBy: "system",
        companyDetails: client,
      });
      generated.push("CT600N");
    }

    // ────────────────────────────────────────────────
    // 3B. GENERATE COMPUTATIONS iXBRL (NEW)
    // ────────────────────────────────────────────────

    // 1. Compute CT figures
    const computations = await computeCtForPeriod({
      clientId,
      periodStart,
      periodEnd,
    });

    // 2. Build iXBRL XHTML
    const computationsIxbrl = await buildComputationsIxbrl({
      clientId,
      companyNumber: client.companyNumber || client.company_number || "",
      companyName: client.business_name || client.name,
      gaapFramework: "FRS102-1A",
      computations,
    });

    // 3. Upload to Supabase
    const ixbrlPath = `ixbrl/CT_COMPUTATIONS_${clientId}_${periodEnd}.xhtml`;

    const { error: ixbrlError } = await supabaseAdmin.storage
      .from("pdfs")
      .upload(ixbrlPath, computationsIxbrl, {
        contentType: "application/xhtml+xml",
        upsert: true,
      });

    if (ixbrlError) {
      console.error("Failed to upload computations iXBRL:", ixbrlError);
    } else {
      generated.push("iXBRL_COMPUTATIONS");
    }

    // ────────────────────────────────────────────────
    // 4. RETURN RESULT
    // ────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      generated,
    });

  } catch (err) {
    console.error("CT pack generation failed:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error generating CT pack.",
    });
  }
}
