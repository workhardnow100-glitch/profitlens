// lib/constants/caMap.js

export const CA_MAP = {
  mainPool: [
    // Standard plant & machinery
    "Plant & Machinery",
    "Tools & Equipment",
    "Computers & IT Equipment",
    "Fixtures & Fittings",
  ],

  specialRatePool: [
    // Special rate assets (future expansion)
    // e.g. integral features, long-life assets
    // Currently empty until you add these categories
  ],

  aiaEligible: [
    // Assets eligible for Annual Investment Allowance
    "Plant & Machinery",
    "Tools & Equipment",
    "Computers & IT Equipment",
    "Fixtures & Fittings",
    "Vehicles", // Only vans, not cars — logic handled in API
  ],

  nonAiaEligible: [
    // Cars are NOT eligible for AIA
    // (Handled in logic, but listed here for clarity)
    // You can add "Cars" later if you create a separate category
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

    // Normal business categories (not capital assets)
    "Sales",
    "Other Income",
    "Refunds Received",
    "Grants / Government Support",
    "Insurance Payouts",
    "Asset Sale Proceeds",

    "Materials",
    "Subcontractors",
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
    "Staff Wages",
    "Employer NI",
    "Employer Pension Contributions",
    "Director Salary (PAYE)",
    "Stock Purchases",
    "Packaging",
    "Delivery to Customers",

    // Disallowable categories
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
