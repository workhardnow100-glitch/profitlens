// lib/constants/vatMap.js

export const VAT_MAP = {
  standardRated: [
    "Sales",
    "Other Income",
    "Stock Purchases",
    "Materials",
    "Subcontractors",
    "Tools & Equipment",
    "Repairs & Maintenance",
    "Fuel",
    "Motor Expenses",
    "Travel & Subsistence",
    "Rent",
    "Utilities",
    "Phone & Internet",
    "Advertising & Marketing",
    "Professional Fees",
    "Software & Subscriptions",
    "Office Supplies",
    "Postage & Delivery",
    "Printing & Stationery",
    "Packaging",
    "Delivery to Customers",
  ],

  zeroRated: [
    // Add if needed — currently no zero-rated categories by default
  ],

  exempt: [
    // Add if needed — currently no exempt categories by default
  ],

  outsideScope: [
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
    "CIS Deducted",
    "CIS Suffered",
    "Corporation Tax Payment",
    "Corporation Tax Refund",
    "SA Payment",
    "SA Refund",

    // Director Loan Account movements
    "Director Loan – Drawings",
    "Director Loan – Repayments",
    "Director Loan – Interest Charged",
    "Director Loan – Interest Paid",

    // Disallowable categories (VAT does not apply)
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
