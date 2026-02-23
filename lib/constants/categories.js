export const CATEGORIES = {
  income: [
    "Sales",
    "Other Income",
    "Refunds Received",
    "Grants / Government Support",
    "Insurance Payouts",
    "Asset Sale Proceeds",
  ],

  allowable: [
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
    "Bank Charges",
    "Charges", // <-- ADDED to match CT_MAP.allowable
    "Insurance",
    "Advertising & Marketing",
    "Professional Fees",
    "Software & Subscriptions",
    "Office Supplies",
    "Postage & Delivery",
    "Printing & Stationery",
    "Loans",


    "Staff Wages",
    "Employer NI",
    "Employer Pension Contributions",
    "Director Salary (PAYE)",

    "Stock Purchases",
    "Packaging",
    "Delivery to Customers",

    "Plant & Machinery",
    "Vehicles",
    "Computers & IT Equipment",
    "Fixtures & Fittings",
  ],

  disallowable: [
    "Clothing",
    "Groceries",
    "Entertainment",
    "Gifts",
    "Personal Spending",
    "Cash Withdrawals",
    "Fines & Penalties",

    // Director-specific
    "Director Payments (Disallowable)",
    "Director Personal Expenses",
    "Client Entertainment",

    // REMOVED to match CT_MAP.ignore:
    // "Loan Repayments",
    // "Credit Card Payments",
  ],

  dla: [
    "Director Loan – Drawings",
    "Director Loan – Repayments",
    "Director Loan – Interest Charged",
    "Director Loan – Interest Paid",
  ],

  system: [
    "Transfers",
    "Internal Transfers",
    "Transfer Between Accounts", // <-- ADDED so UI can pick it
    "Returned Direct Debit",
    "Bank Transfer In",
    "Bank Transfer Out",
    "Card Payment",
    "Cash Deposit",

    // Move these here to match CT_MAP.ignore:
    "Loan Repayments",
    "Credit Card Payments",
  ],

  tax: [
    "VAT Paid",
    "VAT Collected",
    "VAT Adjustment",
    "CIS Deducted",
    "CIS Suffered",
    "Corporation Tax Payment",
    "Corporation Tax Refund",
    "SA Payment",
    "SA Refund",
  ],
};
