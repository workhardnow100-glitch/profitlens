// lib/email/sendEmail.js
// PURPOSE:
//   Provide a generic SMTP email sender using environment variables.
//   Used by parts of the system that do not rely on the Gmail-specific transport.
//
// POSITION IN PIPELINE:
//   • Does NOT touch money, totals, VAT, or invoice logic.
//   • Only responsible for sending email content.
//
// MONEY MODEL:
//   • No monetary fields are read or written.
//   • No pence/pounds conversions.
//   • Safe and correct.

import nodemailer from "nodemailer";

export async function sendEmail({ to, subject, html, text = "" }) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    secure: Number(process.env.EMAIL_SERVER_PORT) === 465, // SSL if port 465
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });

    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Email send error:", err.message);
    return { success: false, error: err.message };
  }
}
