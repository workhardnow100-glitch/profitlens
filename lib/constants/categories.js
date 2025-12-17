// lib/constants/categories.js

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
    "Insurance",
    "Advertising & Marketing",
    "Professional Fees",
    "Software & Subscriptions",
    "Office Supplies",
    "Postage & Delivery",
    "Printing & Stationery",

    // Payroll (Allowable)
    "Staff Wages",
    "Employer NI",
    "Employer Pension Contributions",
    "Director Salary (PAYE)",

    // Cost of Sales
    "Stock Purchases",
    "Packaging",
    "Delivery to Customers",

    // Capital Allowances (special handling later)
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
    "Loan Repayments",
    "Credit Card Payments",

    // Director-specific
    "Director Payments (Disallowable)",
    "Director Personal Expenses",
    "Client Entertainment",
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
    "Returned Direct Debit",
    "Bank Transfer In",
    "Bank Transfer Out",
    "Card Payment",
    "Cash Deposit",
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
