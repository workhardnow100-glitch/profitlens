// pages/api/tax.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ✅ Enforce POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ✅ Validate session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ✅ Accountant-aware client ID
  const actingClientId =
    session.user.actingAsClientId || session.user.clientId;

  const { clientId, taxType, from, to } = req.body;

  // ✅ Validate required parameters
  if (!clientId || !taxType || !from || !to) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  // ✅ Prevent accountants from spoofing clientId
  if (session.user.role === "accountant" && clientId !== actingClientId) {
    return res.status(403).json({
      error: "Accountants cannot request tax data for unauthorized clients",
    });
  }

  // ✅ AUDIT LOG — Accountant calculating tax
  if (session.user.role === "accountant") {
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: "ACCOUNTANT_CALCULATE_TAX",
        details: `Calculated ${taxType.toUpperCase()} for period ${from} → ${to}`,
      },
    ]);
  }

  // ✅ Fetch transactions for client + date range
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("client_id", clientId)
    .gte("date", from)
    .lte("date", to);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // ✅ Route to correct tax calculation
  let calculations = {};

  switch (taxType) {
    case "vat":
      calculations = calculateVAT(transactions);
      break;
    case "cis":
      calculations = calculateCIS(transactions);
      break;
    case "corp":
      calculations = calculateCorporationTax(transactions);
      break;
    default:
      return res.status(400).json({ error: "Unsupported tax type" });
  }

  // ✅ Return calculated results + source transactions
  return res.status(200).json({
    taxType,
    period: { from, to },
    calculations,
    transactions,
  });
}

/* =========================
   VAT CALCULATION (HMRC)
   ========================= */
function calculateVAT(transactions) {
  const vatTx = transactions.filter((t) => t.vat_rate !== null);

  const box1 = vatTx.reduce((sum, t) => sum + (t.vat_amount || 0), 0);

  const box6 = vatTx
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const box7 = vatTx
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    box1_vat_due: round(box1),
    box2_vat_due_acquisitions: 0,
    box3_total_vat_due: round(box1),
    box4_vat_reclaimed: round(box7 * 0),
    box5_net_vat: round(box1),
    box6_total_sales_ex_vat: round(box6),
    box7_total_purchases_ex_vat: round(box7),
    box8_eu_supplies: 0,
    box9_eu_acquisitions: 0,
  };
}

/* =========================
   CIS CALCULATION
   ========================= */
function calculateCIS(transactions) {
  const cisTx = transactions.filter((t) => t.category === "cis");

  const grossIncome = cisTx.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const deducted = cisTx.reduce((sum, t) => sum + (t.vat_amount || 0), 0);

  return {
    grossIncome: round(grossIncome),
    cisDeducted: round(deducted),
  };
}

/* =========================
   CORPORATION TAX (ESTIMATE)
   ========================= */
function calculateCorporationTax(transactions) {
  const income = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const profit = income - expenses;
  const corpTaxRate = 0.25;

  return {
    income: round(income),
    expenses: round(expenses),
    profit: round(profit),
    estimatedCorporationTax: round(profit * corpTaxRate),
  };
}

function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
