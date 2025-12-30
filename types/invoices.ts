// types/invoices.ts

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "part_paid"
  | "paid"
  | "overdue"
  | "cancelled";

// -----------------------------
// Line items
// -----------------------------
export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  category?: string | null;
}

// -----------------------------
// Payment instructions
// -----------------------------
export interface PaymentInstructions {
  bank_name?: string;
  account_name?: string;
  sort_code?: string;
  account_number?: string;
  reference_hint?: string;
  other_instructions?: string;
}

// -----------------------------
// Invoice Defaults (NEW)
// -----------------------------
export interface InvoiceSettings {
  user_id: string;
  default_payment_terms: string | null;
  default_vat_rate: number | null;
  default_notes: string | null;
  default_payment_instructions: string | null;
  default_footer: string | null;
  default_invoice_prefix: string | null;
  updated_at?: string | null;
}

// -----------------------------
// Invoice creation input (NEW)
// Used in pages/invoices/new.tsx
// -----------------------------
export interface InvoiceInput {
  client_id: string;
  issue_date: string;
  due_date: string;
  payment_terms: string;
  vat_rate: number;
  notes_to_client?: string | null;
  payment_instructions?: PaymentInstructions | null;
  footer_text?: string | null;
  invoice_prefix?: string | null;
  line_items: InvoiceLineItemInput[];
}
