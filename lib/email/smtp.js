// lib/email/smtp.js
// PURPOSE:
//   Provide a simple, reliable SMTP transport for sending emails.
//   Used by invoice emails, recurring emails, and system notifications.
//
// POSITION IN PIPELINE:
//   • Does NOT touch money, totals, VAT, or invoice logic.
//   • Only responsible for sending email content + attachments.
//
// MONEY MODEL:
//   • No monetary fields are read or written.
//   • No pence/pounds conversions.
//   • Safe and correct.

import nodemailer from "nodemailer";

const user = process.env.SMTP_USER; // Gmail address
const pass = process.env.SMTP_PASS; // Gmail App Password

if (!user || !pass) {
  console.warn(
    "SMTP_USER or SMTP_PASS not set. Email sending will fail until these env vars are configured."
  );
}

export const mailer = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
});

/**
 * Sends an email via Gmail SMTP.
 *
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} [options.text]
 * @param {Array} [options.attachments]
 */
export async function sendMail({ to, subject, html, text, attachments = [] }) {
  const fromName = "ProfitLens Billing";
  const fromAddress = process.env.SMTP_USER;

  if (!fromAddress) {
    throw new Error("SMTP_USER is not set; cannot determine From address.");
  }

  const from = `"${fromName}" <${fromAddress}>`;

  return mailer.sendMail({
    from,
    to,
    subject,
    html,
    text,
    attachments,
  });
}
