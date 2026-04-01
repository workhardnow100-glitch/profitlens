// lib/ct/computationsTypes.ts

export interface CtComputations {
  periodStart: string; // ISO
  periodEnd: string;   // ISO

  taxableProfit: number;
  corporationTaxDue: number;

  // Extend as needed:
  // addBacks: { label: string; amount: number }[];
  // deductions: { label: string; amount: number }[];
  // capitalAllowancesTotal: number;
  // rAndDEnhancedAmount: number;
  // lossesBroughtForwardUsed: number;
  // lossesCarriedForward: number;
}
