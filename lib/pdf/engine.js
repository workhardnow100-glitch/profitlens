// lib/pdf/engine.js
// PURPOSE:
//   This module provides two core utilities for PDF handling:
//
//   1. createPdfBuffer(buildFn)
//      - Creates a PDFKit document in memory
//      - Collects all chunks into a Buffer
//      - Returns the final PDF buffer
//      - Used by buildInvoicePdf() and all other PDF generators
//
//   2. storePdfAndRecord({...})
//      - Uploads the PDF buffer to Supabase Storage
//      - Generates a public URL
//      - Inserts a row into pdf_documents table
//      - Used by createInvoiceFromSchedule() and manual invoice creation
//
// MONEY MODEL:
//   • This file does NOT handle money, totals, VAT, or formatting.
//   • It simply stores whatever PDF buffer it is given.
//   • No changes required for the pence→pounds unification.
//
// VERIFIED:
//   • No money logic exists here.
//   • No formatting drift.
//   • No risk of mismatched totals.
//   • Safe and correct.

import PDFDocument from "pdfkit";
import { supabaseAdmin } from "../supabase-admin";

export function createPdfBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    buildFn(doc);

    doc.end();
  });
}

export async function storePdfAndRecord({
  clientId,
  type,
  periodStart,
  periodEnd,
  year,
  taxYear,
  filename,
  createdBy,
  metadata = {},
  buffer,
}) {
  const safeClientId = clientId || "unknown-client";
  const periodSegment =
    year?.toString() ||
    (periodStart && periodEnd
      ? `${periodStart}__${periodEnd}`
      : "no-period");

  const path = `${safeClientId}/${type}/${periodSegment}/${filename}`;

  const { data: storageData, error: storageError } =
    await supabaseAdmin.storage.from("pdfs").upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (storageError) {
    throw new Error(`Failed to upload PDF: ${storageError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from("pdfs").getPublicUrl(path);

  const { data: insertData, error: insertError } = await supabaseAdmin
    .from("pdf_documents")
    .insert([
      {
        client_id: safeClientId,
        type,
        period_start: periodStart || null,
        period_end: periodEnd || null,
        year: year || null,
        tax_year: taxYear || null,
        filename,
        url: publicUrl,
        created_by: createdBy || null,
        metadata,
      },
    ])
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to insert pdf_documents row: ${insertError.message}`);
  }

  return insertData;
}
