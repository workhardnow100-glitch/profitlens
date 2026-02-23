// lib/constants/ctMap.js

export const CT_MAP = {
  // ⭐ REAL REVENUE ONLY
  revenue: [
    "Sales",
    "Other Income", // only trading income
  ],

  // ⭐ NON‑TRADING INCOME (NOT revenue)
  income: [
    "Refunds Received",
    "Grants / Government Support",
    "Insurance Payouts",
    "Asset Sale Proceeds",
    "Director Loan – Interest Charged",
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
    "Charges",
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

    "Director Loan – Interest Paid",
  ],

  disallowable: [
    "Clothing",
    "Groceries",
    "Entertainment",
    "Gifts",
    "Personal Spending",
    "Cash Withdrawals",
    "Fines & Penalties",

    "Director Payments (Disallowable)",
    "Director Personal Expenses",
    "Client Entertainment",

    "Director Loan – Drawings",
  ],

  ignore: [
    "Transfers",
    "Internal Transfers",
    "Transfer Between Accounts",
    "Returned Direct Debit",
    "Bank Transfer In",
    "Bank Transfer Out",
    "Card Payment",
    "Cash Deposit",

    "VAT Paid",
    "VAT Collected",
    "VAT Adjustment",
    "CIS Deducted",
    "CIS Suffered",
    "Corporation Tax Payment",
    "Corporation Tax Refund",
    "SA Payment",
    "SA Refund",

    "Director Loan – Repayments",

    "Loan Repayments",
    "Credit Card Payments",
  ],

  review: [],
};
