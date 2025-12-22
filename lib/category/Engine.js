// lib/categoryEngine.js
import { CT_MAP } from "../constants/ctMap.js";

// ✅ Build a single set of all allowed CT_MAP categories
export const ALLOWED_BUSINESS_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
]);

/**
 * classifyFromRaw
 * ----------------
 * Maps raw_category + type + description + amount → CT_MAP category.
 * Only used at upload time when business_category is null.
 */
export function classifyFromRaw({ raw_category, type, description, amount }) {
  const raw = (raw_category || "").toLowerCase();
  const desc = (description || "").toLowerCase();
  const t = (type || "").toUpperCase();
  const value = Number(amount) || 0;

  // ✅ 1. BANK CHARGES
  if (
    raw.includes("bank fee") ||
    raw.includes("bank charge") ||
    raw.includes("charges") ||
    /NON-GBP TRANS FEE/i.test(description || "")
  ) {
    return "Bank Charges";
  }

  // ✅ 2. MOBILE & INTERNET
  if (
    raw.includes("mobile") ||
    raw.includes("internet") ||
    raw.includes("broadband") ||
    raw.includes("phone")
  ) {
    return "Mobile & Internet";
  }

  // ✅ 3. UTILITIES
  if (
    raw.includes("utilities") ||
    raw.includes("gas") ||
    raw.includes("electric") ||
    raw.includes("water")
  ) {
    return "Utilities";
  }

  // ✅ 4. FUEL
  if (raw.includes("fuel") || raw.includes("petrol") || raw.includes("diesel")) {
    return "Fuel";
  }

  // ✅ 5. INSURANCE
  if (raw.includes("insurance") || desc.includes("insurance")) {
    return "Insurance";
  }

  // ✅ 6. ADVERTISING & MARKETING
  if (
    raw.includes("advertising") ||
    raw.includes("ads") ||
    desc.includes("google ads") ||
    desc.includes("facebook ads")
  ) {
    return "Advertising & Marketing";
  }

  // ✅ 7. SUBSCRIPTIONS
  if (
    raw.includes("subscription") ||
    raw.includes("subscriptions") ||
    desc.includes("netflix") ||
    desc.includes("spotify") ||
    desc.includes("prime")
  ) {
    return "Software & Subscriptions";
  }

  // ✅ 8. GROCERIES (disallowable)
  if (raw.includes("groceries") || desc.includes("tesco") || desc.includes("asda")) {
    return "Groceries";
  }

  // ✅ 9. ENTERTAINMENT (disallowable)
  if (
    raw.includes("entertainment") ||
    desc.includes("cinema") ||
    desc.includes("theatre")
  ) {
    return "Entertainment";
  }

  // ✅ 10. CASH WITHDRAWALS (disallowable)
  if (raw.includes("cash withdrawal") || t === "CPT") {
    return "Cash Withdrawals";
  }

  // ✅ 11. HMRC / TAX PAYMENTS (ignore)
  if (desc.includes("hmrc") || raw.includes("tax payment")) {
    if (desc.includes("vat")) return "VAT Paid";
    if (desc.includes("cis")) return "CIS Suffered";
    if (desc.includes("corporation")) return "Corporation Tax Payment";
    if (desc.includes("self assessment") || desc.includes("sa")) return "SA Payment";
    return "Corporation Tax Payment";
  }

  // ✅ 12. TRANSFERS (ignore)
  if (t === "TFR" || raw.includes("transfer")) {
    return "Transfers";
  }

  // ✅ 13. REFUNDS (income)
  if (raw.includes("refund") || desc.includes("refund")) {
    return "Refunds Received";
  }

  // ✅ 14. INCOME (positive amounts)
  if (value > 0 && raw.includes("income")) {
    return "Sales";
  }

  // ✅ 15 DEFAULT → Uncategorised (review bucket)
  return "Uncategorised";
}
