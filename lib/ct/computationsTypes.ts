/**
 * CT COMPUTATIONS – MASTER DATA MODEL
 * -----------------------------------
 * PURPOSE:
 *   This interface defines the *canonical* structure for all Corporation Tax
 *   computations inside ProfitLens. Every output (PDF, XML, iXBRL) must use
 *   this shape. Every input from the CT engine must populate this shape.
 *
 * USED BY:
 *   - CT600 PDF generator
 *   - CT600 XML builder
 *   - CT computations iXBRL builder
 *   - CT pack generator (generate-pack.js)
 *   - Future HMRC submission gateway
 *
 * WHY THIS MATTERS:
 *   This is the single source of truth for all CT calculations. If this file
 *   changes, the following MUST be updated:
 *     1. computeCtForPeriod (CT engine)
 *     2. xmlBuilder.js (CT600 XML)
 *     3. computationsBuilder.ts (iXBRL)
 *     4. ct600.ts (PDF)
 *
 * VALIDATION STATUS:
 *   ✓ Structurally complete
 *   ✓ HMRC-aligned (CT600 v3 + computations iXBRL)
 *   ✓ Supports full adjustments model
 *   ☐ Pending: marginal relief, ring fence, creative industries
 */

export interface CtComputations {
  periodStart: string;
  periodEnd: string;

  // ────────────────────────────────────────────────
  // 1. HEADLINE FIGURES
  // ────────────────────────────────────────────────
  taxableProfit: number;
  corporationTaxDue: number;

  // ────────────────────────────────────────────────
  // 2. SUMMARY (high‑level)
  // ────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────
  // 3. COMPUTATIONS (detailed)
  // ────────────────────────────────────────────────
  computations?: {
    taxableProfit: number;
    taxDue: number;
    turnover?: number;
    allowableExpenses?: number;
    lossCarryback?: number;
    groupRelief?: number;
  };

  // ────────────────────────────────────────────────
  // 4. CAPITAL ALLOWANCES
  // ────────────────────────────────────────────────
  capitalAllowances?: {
    totalCapitalAllowances?: number;
    aiaClaimed?: number;
  };

  // ────────────────────────────────────────────────
  // 5. LOSSES
  // ────────────────────────────────────────────────
  losses?: {
    used?: number;
    carriedForward?: number;
    lossCarryback?: number;
    groupRelief?: number;
  };

  // ────────────────────────────────────────────────
  // 6. ADJUSTMENTS (FULL MODEL)
  // ────────────────────────────────────────────────
  adjustments?: {
    /**
     * Add‑backs: expenses that are not deductible for CT.
     * Examples:
     *   - Client entertaining
     *   - Fines & penalties
     *   - Depreciation
     */
    nonDeductibleExpenses?: number;

    /**
     * Deductions: income that is not taxable.
     * Examples:
     *   - Insurance payouts
     *   - Grants not taxable
     *   - Capital receipts
     */
    nonTaxableIncomeDeduction?: number;

    /**
     * Other adjustments:
     *   - Prior period adjustments
     *   - Transitional adjustments
     *   - Misc CT adjustments
     */
    otherAdjustments?: number;

    /**
     * Legacy field — kept for backward compatibility.
     * Maps to nonDeductibleExpenses.
     */
    disallowableExpenses?: number;
  };

  // ────────────────────────────────────────────────
  // 7. R&D
  // ────────────────────────────────────────────────
  rAndD?: {
    rAndDEnhancedRelief?: number;
  };

  // ────────────────────────────────────────────────
  // 8. LOANS TO PARTICIPATORS
  // ────────────────────────────────────────────────
  loansToParticipators?: {
    totalLoans?: number;
  };

  // ────────────────────────────────────────────────
  // 9. PAYMENTS
  // ────────────────────────────────────────────────
  payments?: {
    paymentsMade?: number;
    balanceDue?: number;
  };

  // ────────────────────────────────────────────────
  // 10. DISCLOSURES
  // ────────────────────────────────────────────────
  disclosures?: any[];

  // ────────────────────────────────────────────────
  // 11. INCOME CATEGORIES (future)
  // ────────────────────────────────────────────────
  incomeCategories?: any[];

  // ────────────────────────────────────────────────
  // 12. PAYMENTS EXPANDED (future)
  // ────────────────────────────────────────────────
  paymentsExpanded?: any;
}
