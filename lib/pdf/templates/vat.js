// lib/pdf/templates/vat.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateVatPdf({
  clientId,
  periodStart,
  periodEnd,
  year,
  taxYear,
  filename,
  createdBy,

  vatBoxes = {},
  transactions = [],
  adjustments = [],
  companyDetails = {},
}) {
  const logoPath = path.join(process.cwd(), "lib/pdf/assets/logo.jpg");
  const logoExists = fs.existsSync(logoPath);

  const buffer = await createPdfBuffer((doc) => {
    const margin = 40;

    //
    // ────────────────────────────────────────────────
    // OUTER PAGE BORDER
    // ────────────────────────────────────────────────
    //
    doc
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .rect(margin / 2, margin / 2, doc.page.width - margin, doc.page.height - margin)
      .stroke();

    //
    // ────────────────────────────────────────────────
    // HEADER: LOGO (RIGHT) + TITLE
    // ────────────────────────────────────────────────
    //
    if (logoExists) {
      const logoWidth = 60;
      const logoX = doc.page.width - margin - logoWidth;
      const logoY = margin;

      doc.image(logoPath, logoX, logoY, { width: logoWidth });
    }

    // Ensure cursor is below logo
    doc.y = Math.max(doc.y, margin + 70);

    doc
      .fontSize(22)
      .fillColor("black")
      .text("VAT Return", { align: "center" })
      .moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    // CLIENT DETAILS BLOCK (bordered)
    // ────────────────────────────────────────────────
    //
    const boxX = margin;
    const boxY = doc.y;
    const boxWidth = doc.page.width - margin * 2;

    doc.y = boxY + 10;
    doc.fontSize(12);

    const headerFields = [
      ["Client", companyDetails?.name],
      ["Business", companyDetails?.businessName],
      ["Email", companyDetails?.email],
      ["Phone", companyDetails?.phone],
      ["Address", companyDetails?.address],
      ["Company Number", companyDetails?.companyNumber],
      ["VAT Number", companyDetails?.vatNumber],
      ["Client ID", clientId],
      ["Tax Year", taxYear],
      ["Period Start", periodStart],
      ["Period End", periodEnd],
    ];

    headerFields.forEach(([label, value]) => {
      if (value) doc.text(`${label}: ${value}`);
    });

    const boxBottomY = doc.y + 10;
    const boxHeight = boxBottomY - boxY;

    doc
      .strokeColor("#999999")
      .lineWidth(1)
      .rect(boxX, boxY, boxWidth, boxHeight)
      .stroke();

    doc.moveDown(2);

    //
    // ────────────────────────────────────────────────
    // VAT BOXES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("VAT Boxes", { underline: true }).moveDown(0.8);

    const boxLabels = {
      box1: "VAT due on sales",
      box2: "VAT due on acquisitions",
      box3: "Total VAT due (1 + 2)",
      box4: "VAT reclaimed on purchases",
      box5: "Net VAT to pay (3 − 4)",
      box6: "Total sales (net)",
      box7: "Total purchases (net)",
      box8: "EU supplies (net)",
      box9: "EU acquisitions (net)",
    };

    Object.entries(boxLabels).forEach(([key, label]) => {
      const value = vatBoxes[key];
      doc.fontSize(12).text(`${label}: £${Number(value || 0).toFixed(2)}`);
    });

    //
    // ────────────────────────────────────────────────
    // ADJUSTMENTS
    // ────────────────────────────────────────────────
    //
    if (adjustments.length > 0) {
      doc.moveDown();
      doc.fontSize(16).text("Adjustments", { underline: true }).moveDown(0.8);

      adjustments.forEach((adj) => {
        doc.fontSize(12).text(
          `Box ${adj.box}: £${Number(adj.amount || 0).toFixed(2)} — ${
            adj.reason || "No reason provided"
          }`
        );
      });
    }

    //
    // ────────────────────────────────────────────────
    // TRANSACTIONS (NEW PAGE)
    // ────────────────────────────────────────────────
    //
    if (transactions.length > 0) {
      doc.addPage();

      // Outer border on new page
      doc
        .strokeColor("#CCCCCC")
        .lineWidth(1)
        .rect(margin / 2, margin / 2, doc.page.width - margin, doc.page.height - margin)
        .stroke();

      doc.y = margin;

      doc.fontSize(16).text("VAT Transactions", { underline: true }).moveDown(1);

      transactions.forEach((tx) => {
        const net = Number(tx.amount || 0) - Number(tx.vat_amount || 0);
        const vat = Number(tx.vat_amount || 0);

        doc.fontSize(12).text(
          `${tx.date} | ${tx.description} | Net: £${net.toFixed(
            2
          )} | VAT: £${vat.toFixed(2)}`
        );
      });
    }

    //
    // ────────────────────────────────────────────────
    // FOOTER — BRAND + DISCLAIMER
    // ────────────────────────────────────────────────
    //
    doc.moveDown(3);

    doc
      .fontSize(10)
      .fillColor("gray")
      .text("ProfitLens Technologies Ltd", { align: "center" })
      .moveDown(0.5);

    doc
      .fontSize(8)
      .fillColor("gray")
      .text(
        "ProfitLens provides estimates only. Always verify figures before filing with HMRC. Nothing displayed here constitutes tax, accounting, or legal advice.",
        { align: "center" }
      );
  });

  //
  // STORE PDF
  //
  const record = await storePdfAndRecord({
    clientId,
    type: "vat",
    periodStart,
    periodEnd,
    year,
    taxYear,
    filename,
    createdBy,
    metadata: {
      vatBoxes,
      transactions,
      adjustments,
      companyDetails,
    },
    buffer,
  });

  return record;
}
