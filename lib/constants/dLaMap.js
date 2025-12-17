// lib/constants/dlaMap.js

export const DLA_MAP = {
  drawings: [
    // Money taken OUT of the company by the director
    "Director Loan – Drawings",
  ],

  repayments: [
    // Money paid BACK INTO the company by the director
    "Director Loan – Repayments",
  ],

  interestCharged: [
    // Interest the company charges the director (income to the company)
    "Director Loan – Interest Charged",
  ],

  interestPaid: [
    // Interest the company pays on the director loan (rare)
    "Director Loan – Interest Paid",
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

    // Normal business categories (not part of DLA)
    "Sales",
    "Other Income",
    "Refunds Received",
    "Grants / Government Support",
    "Insurance Payouts",
    "Asset Sale Proceeds",

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

    // Disallowable categories (not DLA)
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
