// lib/constants/ctMap.js

export const CT_MAP = {
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
    "Mobile & Internet",          // ✅ Added
    "Bank Charges",
    "Charges",                    // ✅ Added
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

  ignore: [
    // System categories that do not affect CT
    "Transfers",
    "Internal Transfers",
    "Transfer Between Accounts",   // ✅ Added
    "Returned Direct Debit",
    "Bank Transfer In",
    "Bank Transfer Out",
    "Card Payment",
    "Cash Deposit",

    // Tax movements (not part of CT calculation)
    "VAT Paid",
    "VAT Collected",
    "VAT Adjustment",
    "CIS Deducted",
    "CIS Suffered",
    "Corporation Tax Payment",
    "Corporation Tax Refund",
    "SA Payment",
    "SA Refund",

    // Director Loan Account movements (handled separately)
    "Director Loan – Drawings",
    "Director Loan – Repayments",
    "Director Loan – Interest Charged",
    "Director Loan – Interest Paid",
  ],

  review: [
    // Anything not in the above lists will fall into review automatically
  ],
};
