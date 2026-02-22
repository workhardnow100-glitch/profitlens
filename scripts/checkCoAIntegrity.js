// scripts/checkCoAIntegrity.js
// Run with: node scripts/checkCoAIntegrity.js

import { CT_MAP } from "../lib/constants/ctMap.js";
import { CATEGORIES } from "../lib/constants/categories.js";
import { UK_COA } from "../lib/constants/ukCoa.js";

function normalise(str) {
  return (str || "").trim().toLowerCase();
}

function flatten(obj) {
  return Object.values(obj).flat().map(normalise);
}

function flattenUkCoa(coa) {
  return coa.map((acc) => normalise(acc.account_name));
}

console.log("🔍 Running ProfitLens CoA Integrity Checker...\n");

// -----------------------------
// 1. CT_MAP → UK_COA check
// -----------------------------
const ctmapNames = flatten(CT_MAP);
const ukNames = flattenUkCoa(UK_COA);

const missingFromUk = ctmapNames.filter((name) => !ukNames.includes(name));

if (missingFromUk.length) {
  console.log("❌ CT_MAP categories missing in UK_COA:");
  missingFromUk.forEach((n) => console.log("   - " + n));
} else {
  console.log("✅ All CT_MAP categories exist in UK_COA.");
}

console.log("\n");

// -----------------------------
// 2. CATEGORIES → UK_COA check
// -----------------------------
const uiNames = flatten(CATEGORIES);

const missingUi = uiNames.filter((name) => !ukNames.includes(name));

if (missingUi.length) {
  console.log("❌ UI CATEGORIES missing in UK_COA:");
  missingUi.forEach((n) => console.log("   - " + n));
} else {
  console.log("✅ All UI CATEGORIES exist in UK_COA.");
}

console.log("\n");

// -----------------------------
// 3. UK_COA → CT_MAP/CATEGORIES/system check
// -----------------------------
const ctmapSet = new Set(ctmapNames);
const uiSet = new Set(uiNames);

const orphanAccounts = UK_COA.filter((acc) => {
  const name = normalise(acc.account_name);

  const isSystem =
    acc.account_type === "SYSTEM" || acc.hmrc_bucket === "ignore";

  const isBalanceSheet =
    [
      "ASSET",
      "LIABILITY",
      "EQUITY",
      "BANK",
      "ACCOUNTS_RECEIVABLE",
      "ACCOUNTS_PAYABLE",
      "VAT_CONTROL",
      "CONTROL",
    ].includes(acc.account_type);

  if (isSystem || isBalanceSheet) return false;

  return !ctmapSet.has(name) && !uiSet.has(name);
});

if (orphanAccounts.length) {
  console.log("❌ UK_COA accounts not referenced by CT_MAP or CATEGORIES:");
  orphanAccounts.forEach((acc) =>
    console.log(`   - ${acc.account_code} ${acc.account_name}`)
  );
} else {
  console.log("✅ All UK_COA accounts are referenced or system/balance-sheet only.");
}

console.log("\n🎉 Integrity check complete.\n");
