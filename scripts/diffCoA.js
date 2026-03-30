// scripts/diffCoA.js
// Run with: node scripts/diffCoA.js

// Load .env.production without renaming it
import dotenv from "dotenv";
dotenv.config({ path: ".env.production" });

import { createClient } from "@supabase/supabase-js";
import { UK_COA } from "../lib/constants/ukCoa.js";
import { CT_MAP } from "../lib/constants/ctMap.js";
import { CATEGORIES } from "../lib/constants/categories.js";
import { SYSTEM_CATEGORIES } from "../lib/constants/systemCategories.js";

function normalise(str) {
  return (str || "").trim().toLowerCase();
}

function keyByCode(entries) {
  const map = new Map();
  for (const acc of entries) {
    map.set(String(acc.account_code), acc);
  }
  return map;
}

function flatten(obj) {
  return Object.values(obj).flat().map(normalise);
}

async function main() {
  console.log("🔍 Running ProfitLens CoA Diff Tool...\n");

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.production");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  const { data: dbEntries, error } = await supabase
    .from("chart_of_account_entries")
    .select("*")
    .order("account_code", { ascending: true });

  if (error) {
    console.error("❌ Failed to fetch chart_of_account_entries:", error.message);
    process.exit(1);
  }

  console.log(`📊 Loaded ${dbEntries.length} CoA rows from DB.`);
  console.log(`📊 Loaded ${UK_COA.length} CoA rows from UK_COA.js.\n`);

  const dbByCode = keyByCode(dbEntries);
  const ukByCode = keyByCode(UK_COA);

  const ctmapNames = new Set(flatten(CT_MAP));
  const uiNames = new Set(flatten(CATEGORIES));
  const systemNames = new Set(SYSTEM_CATEGORIES.map(normalise));

  // 1) UK_COA codes missing in DB
  const missingInDb = UK_COA.filter(
    (acc) => !dbByCode.has(String(acc.account_code))
  );

  if (missingInDb.length) {
    console.log("❌ UK_COA accounts missing in DB:");
    missingInDb.forEach((acc) =>
      console.log(`   - ${acc.account_code} ${acc.account_name}`)
    );
  } else {
    console.log("✅ All UK_COA account codes exist in DB.");
  }

  console.log("");

  // 2) DB codes not in UK_COA
  const extraInDb = dbEntries.filter(
    (acc) => !ukByCode.has(String(acc.account_code))
  );

  if (extraInDb.length) {
    console.log("❌ DB accounts not present in UK_COA:");
    extraInDb.forEach((acc) =>
      console.log(`   - ${acc.account_code} ${acc.account_name}`)
    );
  } else {
    console.log("✅ No extra DB accounts beyond UK_COA.");
  }

  console.log("");

  // 3) Field mismatches
  const mismatches = [];

  for (const ukAcc of UK_COA) {
    const code = String(ukAcc.account_code);
    const dbAcc = dbByCode.get(code);
    if (!dbAcc) continue;

    const diffs = [];

    if (normalise(ukAcc.account_name) !== normalise(dbAcc.account_name)) {
      diffs.push(`name: "${dbAcc.account_name}" -> "${ukAcc.account_name}"`);
    }

    if ((ukAcc.account_type || "").toUpperCase() !== (dbAcc.account_type || "").toUpperCase()) {
      diffs.push(`type: "${dbAcc.account_type}" -> "${ukAcc.account_type}"`);
    }

    if (normalise(ukAcc.hmrc_bucket) !== normalise(dbAcc.hmrc_bucket)) {
      diffs.push(`hmrc_bucket: "${dbAcc.hmrc_bucket}" -> "${ukAcc.hmrc_bucket}"`);
    }

    if (Boolean(ukAcc.is_system) !== Boolean(dbAcc.is_system)) {
      diffs.push(`is_system: ${dbAcc.is_system} -> ${ukAcc.is_system}`);
    }

    if (Boolean(ukAcc.is_control_account) !== Boolean(dbAcc.is_control_account)) {
      diffs.push(`is_control_account: ${dbAcc.is_control_account} -> ${ukAcc.is_control_account}`);
    }

    if (Boolean(ukAcc.is_bank_account) !== Boolean(dbAcc.is_bank_account)) {
      diffs.push(`is_bank_account: ${dbAcc.is_bank_account} -> ${ukAcc.is_bank_account}`);
    }

    if (Boolean(ukAcc.is_system_protected) !== Boolean(dbAcc.is_system_protected)) {
      diffs.push(`is_system_protected: ${dbAcc.is_system_protected} -> ${ukAcc.is_system_protected}`);
    }

    if (diffs.length) {
      mismatches.push({ code, diffs });
    }
  }

  if (mismatches.length) {
    console.log("❌ Field mismatches between DB and UK_COA:");
    mismatches.forEach((m) => {
      console.log(`   - ${m.code}`);
      m.diffs.forEach((d) => console.log(`       • ${d}`));
    });
  } else {
    console.log("✅ No field mismatches between DB and UK_COA.");
  }

  console.log("");

  // 4) Orphan DB accounts
  const orphanDb = dbEntries.filter((acc) => {
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

    return (
      !ctmapNames.has(name) &&
      !uiNames.has(name) &&
      !systemNames.has(name)
    );
  });

  if (orphanDb.length) {
    console.log("❌ DB accounts not referenced by CT_MAP, CATEGORIES, or SYSTEM_CATEGORIES:");
    orphanDb.forEach((acc) =>
      console.log(`   - ${acc.account_code} ${acc.account_name}`)
    );
  } else {
    console.log("✅ All DB accounts are referenced or system/balance-sheet only.");
  }

  console.log("\n🎉 CoA diff complete.\n");
}

main().catch((err) => {
  console.error("❌ Diff script failed:", err);
  process.exit(1);
});
