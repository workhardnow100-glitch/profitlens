// lib/ct/computationsTypes.ts

export interface CtComputations {
  periodStart: string;
  periodEnd: string;

  // Headline figures
  taxableProfit: number;
  corporationTaxDue: number;

  // 1. Summary (normalised)
  summary: {
    tradingProfit: number;
    adjustments: number;
    capitalAllowances: number;
    lossesUsed: number;
    taxableProfit: number;
    corporationTaxDue: number;
  };

  // 2. Capital Allowances (normalised)
  capitalAllowances: {
    total: number;
    annualInvestmentAllowance: number;
    firstYearAllowance: number;
  };

  // 3. Losses (normalised)
  losses: {
    broughtForward: number;
    used: number;
    carriedForward: number;
  };

  // 4. Adjustments (normalised)
  adjustments: {
    disallowableExpenses: number;
    other: number;
  };

  // 5. Payments (normalised)
  payments: {
    totalPaid: number;
    balancingDue: number;
  };

  // 6. R&D (CT600L)
  rAndD: {
    total: number;
    enhancedDeduction: number;
  };

  // 7. Loans to Participators (CT600A)
  loansToParticipators: {
    outstanding: number;
    writtenOff: number;
  };

  // 8. Disclosures (normalised)
  disclosures: {
    charitableDonations: number;
    politicalDonations: number;
  };

  // 9. Income categories (unchanged)
  incomeCategories: any[];

  // 10. Payments expanded (unchanged)
  paymentsExpanded: any;
}
