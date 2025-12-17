// lib/constants/systemCategories.js

export const SYSTEM_CATEGORIES = [
  // ✅ Internal movements
  "Transfers",
  "Internal Transfers",

  // ✅ Bank events
  "Returned Direct Debit",
  "Bank Transfer In",
  "Bank Transfer Out",
  "Card Payment",
  "Cash Deposit",

  // ✅ Tax movements (not business expenses)
  "VAT Paid",
  "VAT Collected",
  "VAT Adjustment",
  "CIS Deducted",
  "CIS Suffered",
  "Corporation Tax Payment",
  "Corporation Tax Refund",
  "SA Payment",
  "SA Refund",

  // ✅ Director Loan Account movements
  "Director Loan – Drawings",
  "Director Loan – Repayments",
  "Director Loan – Interest Charged",
  "Director Loan – Interest Paid",

  // ✅ UI Categories (MUST be allowed for updates to work)
  "Advertising & Marketing",
  "Refunds Received",
  "Staff Wages",
  "Fuel",
  "Groceries",
  "Client Entertainment",
  "Vehicles",
  "Tools & Equipment",
  "Director Personal Expenses",
  "Fines & Penalties",
  "Clothing",
  "Insurance Payouts",
  "Asset Sale Proceeds",
  "Bank Charges",
  "Director Payments (Disallowable)",
  "Cash Withdrawals",
];
