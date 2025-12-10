// pages/api/transactions.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

// --- Expanded inferCategory ---
function inferCategory(type = "", description = "") {
  const normalized = type?.trim().toUpperCase() || "";
  const desc = description?.toLowerCase?.() || "";

  // Banking codes
  if (normalized === "FPO") return "Payment";
  if (normalized === "TFR") return "Transfer Between Accounts";
  if (normalized === "CHG") return "Bank Fees";
  if (normalized === "DEB") return "Debit";
  if (normalized === "DD") return "Direct Debit";
  if (normalized === "SO") return "Standing Order";
  if (normalized === "INT") return "Interest Income";
  if (normalized === "FPI") return "Transfer In";
  if (normalized === "BP") return "Savings";
  if (normalized === "DEP") return "Bank Charge Waived";
  if (normalized === "PAY") return "Charges";
  if (normalized === "FEE") return "Bank Account Fee";
  if (normalized === "CPT") return "Cash Withdrawl";

  // Regex keyword rules
  const rules = [
    { regex: /\bTESCO|SAINSBURY|MORRISONS|ASDA|ALDI|LIDL|WAITROSE\b/i, category: "Groceries" },
    { regex: /\bUBER|TRAINLINE|TFL|LYFT|TAXI|NATIONAL\s*RAIL\b/i, category: "Transport" },
    { regex: /\bBP|SHELL|ESSO|TEXACO|PETROL|FUEL\b/i, category: "Fuel" },
    { regex: /\bEON|EDF|SCOTTISH\s*POWER|NPOWER|OCTOPUS\s*ENERGY|BRITISH\s*GAS\b/i, category: "Utilities" },
    { regex: /\bBT|VODAFONE|O2|EE|THREE|SKY|VIRGIN\s*MEDIA\b/i, category: "Mobile & Internet" },
    { regex: /\bNETFLIX|SPOTIFY|DISNEY|APPLE\s*MUSIC|AMAZON\s*PRIME|NOW\s*TV|YOUTUBE\s*PREMIUM\b/i, category: "Subscriptions" },
    { regex: /\bJUST\s*EAT|DELIVEROO|DOMINOS|MCDONALDS|KFC|SUBWAY|NANDO\b/i, category: "Dining & Takeaway" },
    { regex: /\bAMAZON|EBAY|ARGOS|ETSY\b/i, category: "Shopping" },
    { regex: /\bRYANAIR|EASYJET|JET2|BRITISH\s*AIRWAYS\b/i, category: "Travel" },
    { regex: /\bHMRC|TAX|VAT|COMPANIES\s*HOUSE\b/i, category: "Tax Payment" },
    { regex: /\bLOAN\b/i, category: "Loan Received" },
    { regex: /\bOVERDRAFT\b/i, category: "Overdraft Repayment" },
    { regex: /\bCASH\s*WITHDRAWAL|ATM|NOTEMACHINE\b/i, category: "Cash Withdrawal" },
    { regex: /\bINVESTMENT|TRADING|IG\.COM|ETORO\b/i, category: "Investment Purchase" },
    { regex: /\bCHARITY|DONATION\b/i, category: "Charity" },
    { regex: /\bPENSION\b/i, category: "Pension" },
    { regex: /\bBENEFIT\b/i, category: "Benefits" },
    { regex: /\bSCHOOL|TUITION\b/i, category: "Education" },
    { regex: /\bCHILDCARE|NURSERY\b/i, category: "Childcare" },
    { regex: /\bCOUNCIL|LOCAL\s*AUTHORITY\b/i, category: "Council Tax" },
    { regex: /\bINSURANCE\b/i, category: "Insurance Premium" },
    { regex: /\bRENT\b/i, category: "Rent" },
    { regex: /\bMORTGAGE\b/i, category: "Mortgage" },
    { regex: /\bHEALTHCARE|NHS|CLINIC|DENTIST|MEDICAL|VISION|DENTAL\b/i, category: "Healthcare" },
    { regex: /\bENTERTAINMENT|CINEMA|ODEON|VUE|THEATRE|TICKETMASTER|EVENTBRITE\b/i, category: "Entertainment" },
    { regex: /\bSUBSCRIPTION\b/i, category: "Subscriptions" },
    { regex: /\bPROFESSIONAL\s*SERVICES|BUSINESS\b/i, category: "Professional Services" },
    { regex: /\bGAMBLING|CASINO|BINGO|BET\b/i, category: "Gambling" },
    { regex: /\bLOAN\s*REPAYMENT\b/i, category: "Loan Repayment" },
    { regex: /\bCREDIT\s*CARD\b/i, category: "Credit Card Payment" },
    { regex: /\bTAX\s*PAYMENT\b/i, category: "Tax Payment" },
    { regex: /\bPROPERTY\s*DEPOSIT\b/i, category: "Property Deposit" },
    { regex: /\bPROPERTY\s*COMPLETION\b/i, category: "Property Completion Payment" },
    { regex: /\bPROPERTY\s*LOAN\s*REPAYMENT\b/i, category: "Property Loan Repayment" },
    { regex: /\bPROPERTY\s*LOAN\s*SETTLEMENT\b/i, category: "Property Loan Settlement" },
    { regex: /\bPROPERTY\s*LOAN\s*DISBURSEMENT\b/i, category: "Property Loan Disbursement" },
    { regex: /\bPROPERTY\s*LOAN\s*REFINANCING\b/i, category: "Property Loan Refinancing" },
    { regex: /\bPROPERTY\s*INSURANCE\b/i, category: "Property Insurance" },
    { regex: /\bBUILDING\s*MAINTENANCE\b/i, category: "Building Maintenance" },
    { regex: /\bSAVINGS\s*DEPOSIT\b/i, category: "Savings Deposit" },
    { regex: /\bRETURNED\s*DIRECT\s*DEBIT\b/i, category: "Returned Direct Debit" },
    { regex: /\bSTANDING\s*ORDER\b/i, category: "Standing Order" },
    { regex: /\bTRUST\s*FUND\s*TRANSFER\b/i, category: "Trust Fund Transfer" },
    { regex: /\bCHARITY\s*PAYMENT\b/i, category: "Charity Payment" },
    { regex: /\bGOVERNMENT\s*PAYMENT\b/i, category: "Government Payment" },
    { regex: /\bCOMPENSATION\s*PAYMENT\b/i, category: "Compensation Payment" },
    { regex: /\bE-?PAYMENT\s*RETURN\b/i, category: "E-Payment Return" },
    { regex: /\bACCOUNT\s*MANAGEMENT\b/i, category: "Account Management" },
    { regex: /\bCASH\s*MANAGEMENT\s*TRANSFER\b/i, category: "Cash Management Transfer" },
    { regex: /\bINTRA\s*COMPANY\s*PAYMENT\b/i, category: "Intra Company Payment" },
    { regex: /\bINTRA\s*PARTY\s*PAYMENT\b/i, category: "Intra Party Payment" },
    { regex: /\bSECURITIES\s*BUY\/SELL\b/i, category: "Securities Buy/Sell" },
    { regex: /\bSWAP\s*CONTRACT\s*PAYMENT\b/i, category: "Swap Contract Payment" },
    { regex: /\bFORWARD\s*FOREIGN\s*EXCHANGE\b/i, category: "Forward Foreign Exchange" },
    { regex: /\bFOREIGN\s*EXCHANGE\s*NETTING\b/i, category: "Foreign Exchange Netting" },
    { regex: /\bTREASURY\s*PAYMENT\b/i, category: "Treasury Payment" },
    { regex: /\bBOND\s*FORWARD\s*NETTING\b/i, category: "Bond Forward Netting" },
    { regex: /\bDERIVATIVES\b/i, category: "Derivatives" },
    { regex: /\bCOPYRIGHT\b/i, category: "Copyright" },
    { regex: /\bLICENSE\s*FEE\b/i, category: "License Fee" },
    { regex: /\bROYALTIES\b/i, category: "Royalties" },
    { regex: /\bCONSUMER\s*THIRD\s*PARTY\s*PAYMENT\b/i, category: "Consumer Third Party Payment" },
    { regex: /\bCAR\s*LOAN\s*REPAYMENT\b/i, category: "Car Loan Repayment" },
    { regex: /\bDENTAL\s*SERVICES\b/i, category: "Dental Services" },
    { regex: /\bMEDICAL\s*SERVICES\b/i, category: "Medical Services" },
    { regex: /\bVISION\s*CARE\b/i, category: "Vision Care" },
    { regex: /\bLONG\s*TERM\s*CARE\s*FACILITY\b/i, category: "Long Term Care Facility" },
    { regex: /\bLABOUR\s*INSURANCE\b/i, category: "Labour Insurance" },
    { regex: /\bLIFE\s*INSURANCE\b/i, category: "Life Insurance" },
    { regex: /\bINSTALMENT\b/i, category: "Instalment" },
    { regex: /\bLOTTERY\b/i, category: "Lottery" },
    { regex: /\bGIFT\b/i, category: "Gift" },
  ];

  for (const rule of rules) {
    if (rule.regex.test(description)) {
      return rule.category;
    }
  }

  if (desc.includes("salary") || desc.includes("payroll")) return "Salary";

  return "Uncategorised";
}
// --- End inferCategory ---

function startOfDay(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(d) {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

// Compute date window for a given period + optional custom from/to
function computeDateWindow(period, customFrom, customTo) {
  const now = new Date();
  const today = startOfDay(now);

  let from = null;
  let to = null;

  switch (period) {
    case "week": {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      from = weekAgo;
      to = endOfDay(today);
      break;
    }
    case "month": {
      from = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
      to = endOfDay(today);
      break;
    }
    case "quarter": {
      const q = Math.floor(today.getMonth() / 3);
      from = startOfDay(new Date(today.getFullYear(), q * 3, 1));
      to = endOfDay(today);
      break;
    }
    case "year": {
      from = startOfDay(new Date(today.getFullYear(), 0, 1));
      to = endOfDay(today);
      break;
    }
    case "last7": {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      from = start;
      to = endOfDay(today);
      break;
    }
    case "last30": {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      from = start;
      to = endOfDay(today);
      break;
    }
    case "last90": {
      const start = new Date(today);
      start.setDate(today.getDate() - 89);
      from = start;
      to = endOfDay(today);
      break;
    }
    case "thisTimeLastYear": {
      const lastYear = today.getFullYear() - 1;
      const end = startOfDay(new Date(lastYear, today.getMonth(), today.getDate()));
      const start = new Date(end);
      start.setDate(end.getDate() - 29);
      from = start;
      to = endOfDay(end);
      break;
    }
    case "custom": {
      from = customFrom ? startOfDay(customFrom) : null;
      to = customTo ? endOfDay(customTo) : null;
      break;
    }
    default: {
      from = null;
      to = null;
    }
  }

  return { from, to };
}

function filterByDateWindow(transactions, from, to) {
  if (!from && !to) return transactions;

  return transactions.filter((tx) => {
    if (!tx.date) return false;
    const d = startOfDay(tx.date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

// ✅ Unified computeSummary with exclusions
function computeSummary(transactions) {
  let income = 0;
  let expenses = 0;
  const categories = {};

  const excludedCategories = new Set([
    "Asset Disposal",
    "Insurance Payout",
    "Internal Transfer",
    "Returned Direct Debit",
    "Transfer Between Accounts",
  ]);

  transactions.forEach((tx) => {
    const amount = Number(tx.amount) || 0;
    const category = tx.category || "Uncategorised";

    if (amount > 0) {
      if (!excludedCategories.has(category)) {
        income += amount;
      }
    } else if (amount < 0) {
      if (!excludedCategories.has(category)) {
        const out = Math.abs(amount);
        expenses += out;
        categories[category] = (categories[category] || 0) + out;
      }
    }
  });

  return {
    income,
    expenses,
    net: income - expenses,
    categories,
  };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);
if (!(isFounder || isSubscribedOrTrial)) {
  return res.status(403).json({ error: "Upgrade required" });
}


  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { period = "month", from: fromParam, to: toParam } = req.query;

  try {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    const enriched = (data || []).map((tx) => {
      const category =
        tx.category?.trim() || inferCategory(tx.type, tx.description);

      return {
        ...tx,
        category,
      };
    });

    const customFrom = fromParam ? new Date(fromParam) : null;
    const customTo = toParam ? new Date(toParam) : null;
    const { from, to } = computeDateWindow(period, customFrom, customTo);

    const filtered = filterByDateWindow(enriched, from, to);
    const summary = computeSummary(filtered);

    return res.status(200).json({
      transactions: enriched,
      filtered,
      summary,
      meta: {
        period,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        countAll: enriched.length,
        countFiltered: filtered.length,
      },
    });
  } catch (err) {
    console.error("❌ Transactions API error:", err.message || err);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
