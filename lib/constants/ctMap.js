// lib/constants/ctMap.ts

export const CT_MAP = {
  // --------------------------------------------------
  // 1) TRADING REVENUE (hmrc_bucket = "income")
  // --------------------------------------------------
  revenue: [
    "Sales",           // 4000
    "Other Income",    // 4001
  ],

  // UI compatibility – same as revenue
  income: [
    "Sales",
    "Other Income",
  ],

  // --------------------------------------------------
  // 2) NON‑TRADING INCOME (hmrc_bucket = "non_trading_income")
  //    NOT part of CT "turnover"
  // --------------------------------------------------
  other_income: [
    "Refunds Received",                 // 4002
    "Grants / Government Support",      // 4003
    "Insurance Payouts",                // 4004
    "Asset Sale Proceeds",              // 4005
    "Director Loan – Interest Charged", // 4006
  ],

  // --------------------------------------------------
  // 3) ALLOWABLE EXPENSES (hmrc_bucket = "allowable")
  // --------------------------------------------------
  allowable: [
    // Core business expenses
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

    // Staff & payroll
    "Staff Wages",
    "Employer NI",
    "Employer Pension Contributions",
    "Director Salary (PAYE)",

    // Trading & logistics
    "Stock Purchases",
    "Packaging",
    "Delivery to Customers",

    // Capex‑style P&L buckets (per your COA)
    "Plant & Machinery",
    "Vehicles",
    "Computers & IT Equipment",
    "Fixtures & Fittings",

    // Finance costs
    "Loans",
    "Loan Liability Adjustment",
    "Director Loan – Interest Paid",

    // SA103 allowable
    "SE – Materials",
    "SE – Subcontractors",
    "SE – Travel",
    "SE – Rent",
    "SE – Utilities",
    "SE – Phone & Internet",
    "SE – Insurance",
    "SE – Bank Charges",
    "SE – Professional Fees",
    "SE – Office Supplies",
    "SE – Capital Allowances",
    "SE – Adjustments",

    // SA105 allowable
    "Property Repairs",
    "Property Insurance",
    "Property Management Fees",
    "Mortgage Interest",
    "Property Utilities",
    "Property Cleaning",
    "Property Advertising",
    "Property Capital Allowances",
    "Property Losses",

    // FHL / Rent‑a‑Room
    "FHL Expenses",
    "Rent-a-Room Expenses",

    // ✅ Clothing is ALLOWABLE in your COA
    "Clothing",
  ],

  // --------------------------------------------------
  // 4) DISALLOWABLE EXPENSES (hmrc_bucket = "disallowable")
  // --------------------------------------------------
  disallowable: [
    "Groceries",
    "Entertainment",
    "Gifts",
    "Personal Spending",
    "Fines & Penalties",
    "Client Entertainment",
    "SE – Disallowable Expenses",
  ],

  // --------------------------------------------------
  // 5) IGNORE / SYSTEM / BALANCE SHEET
  //    (hmrc_bucket = "ignore" or "balance_sheet" or fixed_asset)
  //    These MUST NOT affect CT P&L
  // --------------------------------------------------
  ignore: [
    // System movements (SYSTEM + ignore)
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

    // Balance sheet / director movements
    "Bank",
    "Accounts Receivable",
    "Accounts Payable",
    "Loans",
    "Opening Equity",
    "Retained Earnings",

    "Cash Withdrawals",
    "Director Payments (Disallowable)",
    "Director Personal Expenses",
    "Director Loan – Drawings",

    // Fixed assets (handled via capital allowances, not CT P&L)
    "Office Equipment",
    "Computer Equipment",
    "Tools",
    "Furniture",
    "Machinery",
    "Buildings",
    "Office Improvements",
    "Accumulated Depreciation",

    // Safety net
    "Uncategorised",
    "Suspense",
    "Rounding",
  ],

  // For future flags / reviews if needed
  review: [],
};
