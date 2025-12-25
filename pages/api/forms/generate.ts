// pages/api/forms/generate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

type GenerateRequestBody = {
  clientId: string;
  formCode: string;
  periodStart: string;
  periodEnd: string;
};

type ApiResponse =
  | { success: true; pdfUrl: string; submissionId: string }
  | { success: false; message: string };

const supabaseStorage = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const FORMS_BUCKET = 'forms';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { clientId, formCode, periodStart, periodEnd } = req.body as GenerateRequestBody;

    if (!clientId || !formCode || !periodStart || !periodEnd) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing clientId, formCode, or period range.' });
    }

    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);

    if (Number.isNaN(periodStartDate.getTime()) || Number.isNaN(periodEndDate.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid period start or end date.' });
    }

    // 1. Load client
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    // 2. Load base transactions for this period
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', periodStart)
      .lte('date', periodEnd);

    if (txError) {
      console.error('Error loading transactions:', txError);
      return res.status(500).json({ success: false, message: 'Error loading transactions.' });
    }

    // 3. Branch by formCode and collect form-specific data
    let formData: any = {};
    let formTypeForPdfDocuments = formCode; // directly used as type in pdf_documents
    let periodMeta: { year?: number; tax_year?: string } = {};

    if (formCode.startsWith('CT')) {
      formData = await buildCTFormData(formCode, client, transactions, clientId, periodStart, periodEnd);
    } else if (formCode.startsWith('SA')) {
      formData = await buildSAFormData(formCode, client, transactions, clientId, periodStart, periodEnd);
    } else if (formCode.startsWith('CIS')) {
      formData = await buildCISFormData(formCode, client, transactions, clientId, periodStart, periodEnd);
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported form code.' });
    }

    // Optionally derive year / tax_year for metadata
    periodMeta.year = periodEndDate.getFullYear();
    periodMeta.tax_year = deriveTaxYear(periodEndDate); // e.g. "2024/25"

    // 4. Generate PDF buffer from form data
    const pdfBuffer = await generatePdfForForm(formCode, formData);

    // 5. Upload PDF to Supabase Storage
    const submissionId = uuidv4();
    const filename = `${submissionId}.pdf`;
    const storagePath = `client_${clientId}/${formCode}/${filename}`;

    const { error: uploadError } = await supabaseStorage.storage
      .from(FORMS_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      return res.status(500).json({ success: false, message: 'Failed to upload PDF.' });
    }

    const {
      data: { publicUrl },
    } = supabaseStorage.storage.from(FORMS_BUCKET).getPublicUrl(storagePath);

    // 6. Insert into pdf_documents
    const { error: pdfDocError } = await supabaseAdmin.from('pdf_documents').insert({
      client_id: String(clientId), // pdf_documents.client_id is text in your schema
      type: formTypeForPdfDocuments,
      period_start: periodStart,
      period_end: periodEnd,
      year: periodMeta.year,
      tax_year: periodMeta.tax_year,
      filename,
      url: publicUrl,
      metadata: formData,
      created_by: 'system', // or user email/id later
    });

    if (pdfDocError) {
      console.error('Error inserting pdf_documents:', pdfDocError);
      return res.status(500).json({ success: false, message: 'Failed to save PDF metadata.' });
    }

    return res.status(200).json({
      success: true,
      pdfUrl: publicUrl,
      submissionId,
    });
  } catch (err: any) {
    console.error('Unexpected error in /api/forms/generate:', err);
    return res
      .status(500)
      .json({ success: false, message: err?.message || 'Internal server error.' });
  }
}

/**
 * Build CT form data from your real tables
 */
async function buildCTFormData(
  formCode: string,
  client: any,
  transactions: any[],
  clientId: string,
  periodStart: string,
  periodEnd: string
) {
  // Load corp_submissions for this period if it exists
  const { data: corpSubmission } = await supabaseAdmin
    .from('corp_submissions')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle();

  // Load CT payments
  const { data: ctPayments } = await supabaseAdmin
    .from('ct_payments')
    .select('*')
    .eq('client_id', clientId)
    .gte('payment_date', periodStart)
    .lte('payment_date', periodEnd);

  // Filter CT‑included transactions
  const ctTransactions = transactions.filter((t) => t.includedinct);

  const turnover = sumBy(ctTransactions.filter((t) => Number(t.amount) > 0), 'amount');
  const expenses = sumBy(ctTransactions.filter((t) => Number(t.amount) < 0), 'amount') * -1;

  const profitBeforeTax =
    corpSubmission?.profit_before_tax ??
    (turnover - expenses);

  const corpTaxDue = corpSubmission?.corp_tax_due ?? profitBeforeTax * 0.19; // default 19% if not stored
  const paymentsMade = sumBy(ctPayments || [], 'amount');
  const balanceDue = corpTaxDue - paymentsMade;

  return {
    formCode,
    companyName: client.business_name || client.name,
    tradingName: client.trading_name,
    companyNumber: client.company_number,
    utr: client.utr_number,
    registeredAddress: client.registered_address || client.address,
    periodStart,
    periodEnd,
    turnover,
    expenses,
    profitBeforeTax,
    corpTaxDue,
    paymentsMade,
    balanceDue,
    raw: {
      corpSubmission,
      ctPayments,
      ctTransactionsCount: ctTransactions.length,
    },
  };
}

/**
 * Build SA form data
 */
async function buildSAFormData(
  formCode: string,
  client: any,
  transactions: any[],
  clientId: string,
  periodStart: string,
  periodEnd: string
) {
  const { data: saSubmission } = await supabaseAdmin
    .from('sa_submissions')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle();

  const { data: saPayments } = await supabaseAdmin
    .from('sa_payments')
    .select('*')
    .eq('client_id', clientId)
    .gte('payment_date', periodStart)
    .lte('payment_date', periodEnd);

  const saTransactions = transactions.filter((t) => t.includedinsa);

  const turnover = sumBy(saTransactions.filter((t) => Number(t.amount) > 0), 'amount');
  const expenses = sumBy(saTransactions.filter((t) => Number(t.amount) < 0), 'amount') * -1;

  // Very simplified NIC & tax calculation placeholder
  const profit = turnover - expenses;
  const estimatedTax = profit * 0.2; // just placeholder logic
  const paymentsMade = sumBy(saPayments || [], 'amount');
  const balanceDue = estimatedTax - paymentsMade;

  return {
    formCode,
    taxpayerName: client.name,
    utr: client.utr_number,
    address: client.address,
    periodStart,
    periodEnd,
    turnover,
    expenses,
    profit,
    estimatedTax,
    paymentsMade,
    balanceDue,
    raw: {
      saSubmission,
      saPayments,
      saTransactionsCount: saTransactions.length,
    },
  };
}

/**
 * Build CIS form data
 */
async function buildCISFormData(
  formCode: string,
  client: any,
  transactions: any[],
  clientId: string,
  periodStart: string,
  periodEnd: string
) {
  const { data: cisSubmission } = await supabaseAdmin
    .from('cis_submissions')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle();

  const { data: cisPayments } = await supabaseAdmin
    .from('cis_payments')
    .select('*')
    .eq('client_id', clientId)
    .gte('payment_date', periodStart)
    .lte('payment_date', periodEnd);

  const { data: cisAdjustments } = await supabaseAdmin
    .from('cis_adjustments')
    .select('*')
    .eq('client_id', clientId);

  const cisTransactions = transactions.filter((t) => t.includedincis);

  const cisSuffered = sumBy(cisTransactions || [], 'cis_amount');
  const paymentsMade = sumBy(cisPayments || [], 'amount');
  const adjustmentsTotal = sumBy(cisAdjustments || [], 'amount');

  const netCis =
    cisSubmission?.net_cis ??
    (cisSuffered + adjustmentsTotal - paymentsMade);

  return {
    formCode,
    contractorName: client.business_name || client.name,
    utr: client.utr_number,
    periodStart,
    periodEnd,
    cisSuffered,
    paymentsMade,
    adjustmentsTotal,
    netCis,
    raw: {
      cisSubmission,
      cisPayments,
      cisAdjustments,
      cisTransactionsCount: cisTransactions.length,
    },
  };
}

/**
 * Utility: sum by field
 */
function sumBy(items: any[], field: string): number {
  return (items || []).reduce((sum, item) => {
    const val = Number(item[field] ?? 0);
    if (Number.isNaN(val)) return sum;
    return sum + val;
  }, 0);
}

/**
 * Very basic UK tax year string e.g. "2024/25"
 */
function deriveTaxYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 4) {
    return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
  }
  return `${year - 1}/${String(year % 100).padStart(2, '0')}`;
}

/**
 * THIS is the only place you need to wire in your existing PDF generator.
 * Everything else is fully wired to your schema.
 *
 * Implement using your existing /api/pdf or PDFKit templates.
 */
async function generatePdfForForm(formCode: string, formData: any): Promise<Buffer> {
  // Example pattern if you already have a PDF API or utility:
  //
  // return await createFormPdf({ formCode, formData });
  //
  // For now, we throw to force you to implement with your templates.
  // Replace this with your real PDF generation logic (e.g. PDFKit).
  throw new Error(
    `generatePdfForForm is not implemented yet. Wire this into your existing PDF engine for ${formCode}.`
  );
}
