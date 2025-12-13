import PDFDocument from "pdfkit";

export default async function handler(req, res) {
  const doc = new PDFDocument();
  res.setHeader("Content-Type", "application/pdf");

  doc.text("HMRC MTD Submission Receipt");
  doc.text(`Reference: ${req.query.ref}`);
  doc.text(`Submitted: ${new Date().toISOString()}`);
  doc.end();
  doc.pipe(res);
}
