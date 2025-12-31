import { mailer } from "../mailer";
import { generateInvoiceHtml } from "./templates/invoiceHtmlTemplate"; 
// ^^^ You can adjust this import to wherever your HTML template lives

interface SendInvoiceEmailProps {
  invoice: any;
  customer: any;
  owner: any;
}

export async function sendInvoiceEmail({ invoice, customer, owner }: SendInvoiceEmailProps) {
  if (!customer?.email) {
    console.error("Customer has no email address:", customer);
    return;
  }

  // Build the HTML email body
  const html = generateInvoiceHtml({
    invoice,
    customer,
    owner,
  });

  // Optional: If you generate PDFs, attach them here
  // const pdfBuffer = await generateInvoicePdf(invoice);

  try {
    await mailer.sendMail({
      from: {
        name: owner?.business_name || owner?.name || "ProfitLens",
        address: owner?.email,
      },
      to: customer.email,
      subject: `Invoice from ${owner?.business_name || owner?.name}`,
      html,
      // attachments: [
      //   {
      //     filename: `Invoice-${invoice.id}.pdf`,
      //     content: pdfBuffer,
      //   },
      // ],
    });

    console.log(`Invoice email sent to ${customer.email} for invoice ${invoice.id}`);
  } catch (err) {
    console.error("Failed to send invoice email:", err);
  }
}
