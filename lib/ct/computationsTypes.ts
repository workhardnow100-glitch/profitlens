export interface CtComputations {
  periodStart: string;
  periodEnd: string;

  // Headline figures
  taxableProfit: number;
  corporationTaxDue: number;

  // 1. Summary
  summary?: {
    turnover?: number;
    nonTradingIncome?: number;
    expenses?: number;
    capitalAllowances?: number;
    profitBeforeTax?: number;
    corpTaxDue?: number;
    paymentsMade?: number;
    balanceDue?: number;
  };

  // 2. Computations (high‑level)
  computations?: {
    taxableProfit: number;
    taxDue: number;
    turnover?: number;
    allowableExpenses?: number;
    lossCarryback?: number;
    groupRelief?: number;
  };

  // 3. Capital Allowances
  capitalAllowances?: {
    totalCapitalAllowances?: number;
    aiaClaimed?: number;
  };

  // 4. Losses
  losses?: {
    used?: number;
    carriedForward?: number;
    lossCarryback?: number;
    groupRelief?: number;
  };

  // 5. Adjustments
  adjustments?: {
    disallowableExpenses?: number;
  };

  // 6. R&D
  rAndD?: {
    rAndDEnhancedRelief?: number;
  };

  // 7. Loans to Participators
  loansToParticipators?: {
    totalLoans?: number;
  };

  // 8. Payments
  payments?: {
    paymentsMade?: number;
    balanceDue?: number;
  };

  // 9. Disclosures
  disclosures?: any[];

  // 10. Income Categories
  incomeCategories?: any[];

  // 11. Payments Expanded
  paymentsExpanded?: any;
}
