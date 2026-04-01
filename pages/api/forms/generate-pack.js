// pages/api/forms/generate-pack.js

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
import { buildAccountsIxbrl } from "../../../lib/ixbrl/accountBuilder";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ success: false, message: "Method not allowed" });
    }

    const { clientId, periodStart, periodEnd } = req.body;

    if (!clientId || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Missing clientId, periodStart, or periodEnd.",
      });
    }

    // ────────────────────────────────────────────────
    // 1. LOAD COMPANY DETAILS (FROM SUPABASE)
    // ────────────────────────────────────────────────
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !client) {
      console.error("Failed to load client:", clientError);
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    const companyDetails = {
      name: client.name,
      business_name: client.business_name || client.name,
      trading_name: client.trading_name,
      company_number: client.company_number,
      utr_number: client.utr_number,
      registered_address: client.registered_address || client.address,
      address: client.address,
      postcode: client.postcode,
      phone: client.phone,
      email: client.email,
      website: client.website,
      contact_person: client.contact_person,
      contact_phone: client.contact_phone,
      contact_email: client.contact_email,
      business_type: client.business_type,
      nino: client.nino,
      mtditsa_id: client.mtditsa_id,
    };

    // ────────────────────────────────────────────────
    // 2. DETECT SUPPLEMENTS (JOURNALS FROM SUPABASE)
    // ────────────────────────────────────────────────
    const { data: journals, error: journalsError } = await supabaseAdmin
      .from("journal_entries")
      .select(
        `
        id,
        date,
        client_id,
        lines:journal_lines (
          debit,
          credit,
          account:chart_of_account_entries (
            account_code
          )
        )
      `
      )
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (journalsError) {
      console.error("Failed to load journals:", journalsError);
      return res.status(500).json({
        success: false,
        message: "Failed to load journals for supplement detection.",
      });
    }

    const sumByPrefix = (prefix) =>
      (journals || [])
        .flatMap((j) => j.lines || [])
        .filter((l) => l.account?.account_code?.startsWith(prefix))
        .reduce(
          (sum, l) =>
            sum + Number(l.debit || 0) - Number(l.credit || 0),
          0
        );

    const supplements = {
      ct600ARequired: Math.abs(sumByPrefix("DLA")) > 0,
      ct600JRequired: (journals || []).some((j) =>
        (j.lines || []).some(
          (l) => l.account?.account_code === "DOTAS"
        )
      ),
      ct600LRequired: sumByPrefix("RD") > 0,
      ct600FRequired: sumByPrefix("CHAR") > 0,
      ct600MRequired: sumByPrefix("ROY") > 0,
      ct600NRequired: sumByPrefix("NI") > 0,
    };

    // ────────────────────────────────────────────────
    // 3. COMPUTE CT DATA ONCE
    // ────────────────────────────────────────────────
    const computations = await computeCtForPeriod({
      clientId,
      periodStart,
      periodEnd,
    });

    // ────────────────────────────────────────────────
    // 3A. GENERATE CT600 PDF (WITH FULL DATA)
    // ────────────────────────────────────────────────
    const generated = [];

    await generateCt600Pdf({
      clientId,
      periodStart,
      periodEnd,
      year: new Date(periodEnd).getFullYear(),
      filename: `CT600_${clientId}_${periodEnd}.pdf`,
      createdBy: "system",
      companyDetails,

      ctSummary: computations.summary,
      computations: computations.computations,
      capitalAllowances: computations.capitalAllowances,
      losses: computations.losses,
      adjustments: computations.adjustments,
      rAndD: computations.rAndD,
      loansToParticipators: computations.loansToParticipators,
      payments: computations.payments,
      disclosures: computations.disclosures,

      supplements,
    });
    generated.push("CT600");

    // ────────────────────────────────────────────────
    // 3B. OTHER PDF FORMS
    // ────────────────────────────────────────────────
    if (supplements.ct600ARequired) {
      await generateCt600aPdf({
        clientId,
        periodStart,
        periodEnd,
        year: new Date(periodEnd).getFullYear(),
        filename: `CT600A_${clientId}_${periodEnd}.pdf`,
        createdBy: "system",
        companyDetails,
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
        companyDetails,
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
        companyDetails,
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
        companyDetails,
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
        companyDetails,
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
        companyDetails,
      });
      generated.push("CT600N");
    }

    // ────────────────────────────────────────────────
    // 3C. GENERATE COMPUTATIONS iXBRL
    // ────────────────────────────────────────────────
    const computationsIxbrl = await buildComputationsIxbrl({
      clientId,
      companyNumber: client.company_number || "",
      companyName: client.business_name || client.name,
      gaapFramework: "FRS102-1A",
      computations,
    });

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
    // 3D. GENERATE ACCOUNTS iXBRL (NEW)
    // ────────────────────────────────────────────────
    const { ixbrl: accountsIxbrl, framework } =
      await buildAccountsIxbrl({
        clientId,
        companyNumber: client.company_number || "",
        companyName: client.business_name || client.name,
        periodStart,
        periodEnd,
        defaultFramework: "FRS102-1A",
      });

    const accountsPath = `ixbrl/ACCOUNTS_${framework}_${clientId}_${periodEnd}.xhtml`;

    const { error: accountsError } = await supabaseAdmin.storage
      .from("pdfs")
      .upload(accountsPath, accountsIxbrl, {
        contentType: "application/xhtml+xml",
        upsert: true,
      });

    if (accountsError) {
      console.error("Failed to upload accounts iXBRL:", accountsError);
    } else {
      generated.push(`iXBRL_ACCOUNTS_${framework}`);
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
