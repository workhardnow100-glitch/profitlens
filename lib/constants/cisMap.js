// lib/constants/cisMap.js

export const CIS_MAP = {
  cisSuffered: [
    // CIS suffered on subcontractor invoices
    "CIS Suffered",
  ],

  cisDeducted: [
    // CIS deducted from your sales (if you are a subcontractor)
    "CIS Deducted",
  ],

  ignore: [
    // System categories
    "Transfers",
    "Internal Transfers",
    "Returned Direct Debit",
    "Bank Transfer In",
    "Bank Transfer Out",
    "Card Payment",
    "Cash Deposit",

    // Tax movements
    "VAT Paid",
    "VAT Collected",
    "VAT Adjustment",
    "Corporation Tax Payment",
    "Corporation Tax Refund",
    "SA Payment",
    "SA Refund",

    // Director Loan Account movements
    "Director Loan – Drawings",
    "Director Loan – Repayments",
    "Director Loan – Interest Charged",
    "Director Loan – Interest Paid",

    // Disallowable categories (not relevant for CIS)
    "Clothing",
    "Groceries",
    "Entertainment",
    "Gifts",
    "Personal Spending",
    "Cash Withdrawals",
    "Fines & Penalties",
    "Loan Repayments",
    "Credit Card Payments",
    "Director Payments (Disallowable)",
    "Director Personal Expenses",
    "Client Entertainment",
  ],

  review: [
    // Anything not in the above lists will be flagged automatically
  ],
};
