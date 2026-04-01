// lib/ct/computationsTypes.ts

export interface CtComputations {
  periodStart: string;
  periodEnd: string;

  // Headline figures
  taxableProfit: number;
  corporationTaxDue: number;

  // 1. Summary
  summary?: any;

  // 2. Computations (high‑level)
  computations?: {
    taxableProfit: number;
    taxDue: number;
    capitalAllowances?: any; // object, not array
    losses?: any;            // object, not array
    adjustments?: any;       // object, not array
  };

  // 3. Capital Allowances (full section object)
  capitalAllowances?: any;

  // 4. Losses (full section object)
  losses?: any;

  // 5. Adjustments (full section object)
  adjustments?: any;

  // 6. R&D (CT600L)
  rAndD?: any;

  // 7. Loans to Participators (CT600A)
  loansToParticipators?: any;

  // 8. Payments & Balances
  payments?: any;

  // 9. Additional Disclosures
  disclosures?: any[];

  // 12. Income Categories
  incomeCategories?: any[];

  // 13. Payments & Balances (Expanded)
  paymentsExpanded?: any;
}
