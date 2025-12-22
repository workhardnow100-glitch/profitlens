// pages/api/upload/bulk.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { classifyFromRaw } from "../../../lib/categoryEngine.js";

export const config = {
  api: { bodyParser: false },
};

// ✅ UUID helper
function uuid() {
  return (
    crypto.randomUUID?.() ||
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
  );
}

function toNumber(v) {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toISODate(input) {
  if (!input) return null;
  const raw = String(input).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (match) {
    const [_, d, m, y] = match;
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
}

function parseFileBuffer(filename, buffer) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".csv") {
    const text = buffer.toString("utf8");
    return parseCsv(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  }
  if (ext === ".xlsx") {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: null });
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

function getValue(row, keys = []) {
  for (const k of keys) {
    if (
      row[k] !== undefined &&
      row[k] !== null &&
      String(row[k]).trim() !== ""
    ) {
      return row[k];
    }
  }
  return null;
}

// ✅ Detect reversal pairs
function detectReversalPairs(rows) {
  const pairs = new Map();
  rows.forEach((row, i) => {
    const desc = String(
      getValue(row, ["Transaction Description", "Description", "Details"]) ||
        ""
    ).toUpperCase();
    const isReturned = /RETURNED\s*DD/.test(desc);
    const amount =
      toNumber(getValue(row, ["Credit Amount", "Credit", "Cr"])) ||
      toNumber(getValue(row, ["Debit Amount", "Debit", "Dr"]));
    if (!isReturned || amount === null) return;
    const matchIndex = rows.findIndex((other, j) => {
      if (i === j) return false;
      const otherDesc = String(
        getValue(other, [
          "Transaction Description",
          "Description",
          "Details",
        ]) || ""
      ).toUpperCase();
      const otherAmount =
        toNumber(getValue(other, ["Debit Amount", "Debit", "Dr"])) ||
        toNumber(getValue(other, ["Credit Amount", "Credit", "Cr"]));
      return (
        Math.abs(otherAmount) === Math.abs(amount) &&
        !/RETURNED\s*DD/.test(otherDesc)
      );
    });
    if (matchIndex !== -1) {
      const groupId = crypto.randomUUID();
      pairs.set(i, groupId);
      pairs.set(matchIndex, groupId);
    }
  });
  return pairs;
}

// ✅ Infer descriptive category (raw only, for suggestions)
function inferCategory(type = "", description = "") {
  const normalized = type?.trim().toUpperCase() || "";
  const desc = description?.trim() || "";

  const rules = [
    {
      regex: /\bTESCO|SAINSBURY|MORRISONS|ASDA|ALDI|LIDL|WAITROSE\b/i,
      category: "Groceries",
    },
    {
      regex:
        /\bJUST\s*EAT|DELIVEROO|UBER\s*EATS|DOMINOS|MCDONALDS|KFC|SUBWAY|NANDO\b/i,
      category: "Dining & Takeaway",
    },
    { regex: /\bAMAZON|EBAY|ARGOS|ETSY\b/i, category: "Shopping" },
    {
      regex: /\bUBER|LYFT|TAXI|TRAINLINE|NATIONAL\s*RAIL|TFL\b/i,
      category: "Transport",
    },
    {
      regex: /\bRYANAIR|EASYJET|JET2|BRITISH\s*AIRWAYS\b/i,
      category: "Travel",
    },
    {
      regex: /\bBP|SHELL|ESSO|TEXACO|PETROL|FUEL\b/i,
      category: "Fuel",
    },
    {
      regex: /\bBT|VODAFONE|O2|EE|THREE|SKY|VIRGIN\s*MEDIA\b/i,
      category: "Mobile & Internet",
    },
    {
      regex:
        /\bEON|EDF|SCOTTISH\s*POWER|NPOWER|OCTOPUS\s*ENERGY|BRITISH\s*GAS\b/i,
      category: "Utilities",
    },
    {
      regex:
        /\bNETFLIX|SPOTIFY|DISNEY|APPLE\s*MUSIC|AMAZON\s*PRIME|NOW\s*TV|YOUTUBE\s*PREMIUM\b/i,
      category: "Subscriptions",
    },
    {
      regex:
        /\bFACEBK|META\s*ADS|GOOGLE\s*ADS|LINKEDIN\s*ADS|TWITTER\s*ADS\b/i,
      category: "Advertising",
    },
    {
      regex: /\bHMRC|TAX|VAT|COMPANIES\s*HOUSE\b/i,
      category: "Tax Payment",
    },
    {
      regex: /\bBOOTS|SUPERDRUG|PHARMACY|NHS\b/i,
      category: "Healthcare",
    },
    {
      regex: /\bAVIVA|AXA|DIRECT\s*LINE|LV=|INSURANCE\b/i,
      category: "Insurance Premium",
    },
    {
      regex:
        /\bCINEMA|ODEON|VUE|THEATRE|TICKETMASTER|EVENTBRITE\b/i,
      category: "Entertainment",
    },
    {
      regex: /\bGYM|PUREGYM|DAVID\s*LLOYD|FITNESS\b/i,
      category: "Fitness",
    },
    { regex: /\bSAVETHECHANGE\b/i, category: "Savings Deposit" },
    { regex: /\bRETURNED\s*DD\b/i, category: "Returned DD" },
    { regex: /\bREFUND|REIMBURSEMENT\b/i, category: "Refund" },
  ];

  for (const rule of rules) {
    if (rule.regex.test(desc)) return rule.category;
  }

  switch (normalized) {
    case "FPO":
      return "Payment";
    case "TFR":
      return "Transfer Between Accounts";
    case "CHG":
      return "Bank Fees";
    case "DEB":
      return "Debit";
    case "DD":
      return "Direct Debit";
    case "SO":
      return "Standing Order";
    case "INT":
      return "Interest Income";
    case "FPI":
      return "Transfer In";
    case "BP":
      return "Savings";
    case "DEP":
      return "Bank Charge Waived";
    case "PAY":
      return "Charges";
    case "FEE":
      return "Bank Account Fee";
    case "CPT":
      return "Cash Withdrawal";
    default:
      return "Other";
  }
}

// ✅ Normalise a row — unified, with raw_category, no business_category
function normalizeRow(row, i, clientId, userId, nowIso, reversalPairs) {
  const debit = toNumber(getValue(row, ["Debit Amount", "Debit", "Dr"]));
  const credit = toNumber(getValue(row, ["Credit Amount", "Credit", "Cr"]));
  const balance = toNumber(
    getValue(row, ["Balance", "Closing Balance", "Bal"])
  );

  let amount = null;
  if (debit !== null && credit !== null) {
    amount = credit - debit;
  } else if (debit !== null) {
    amount = -Math.abs(debit);
  } else if (credit !== null) {
    amount = Math.abs(credit);
  }

  const rawDate = getValue(row, ["Transaction Date", "Date"]);
  const date = toISODate(rawDate);

  const description = String(
    getValue(row, ["Transaction Description", "Description", "Details"]) || ""
  ).trim();
  const type = String(
    getValue(row, ["Transaction Type", "Type", "Code"]) || ""
  )
    .trim()
    .toUpperCase();
  const account_number = String(
    getValue(row, ["Account Number", "Account"]) || ""
  ).trim();
  const sort_code = String(
    getValue(row, ["Sort Code", "SortCode"]) || ""
  ).trim();

  const raw_category = inferCategory(type, description);

  const reversal_group_id = reversalPairs?.get(i) || null;
  const is_reversal = !!reversal_group_id;

  return {
    date: date || null,
    description: description || null,
    amount: amount ?? null,
    debit_amount: debit ?? null,
    credit_amount: credit ?? null,
    balance: balance ?? null,

  // ✅ Auto-classify only when null (always null at ingestion)
business_category: classifyFromRaw({
  raw_category,
  type,
  description,
  amount,
}),


    // ✅ Suggestion engine: raw category preserved
    raw_category,

    type: type || null,
    account_number: account_number || null,
    sort_code: sort_code || null,

    reversal_group_id,
    is_reversal,

    source: "upload",
    client_id: clientId,
    user_id: userId,
    created_at: nowIso,
  };
}

function quarterFromDateStr(dateStr) {
  if (!dateStr) return null;
  const [y, m] = dateStr.split("-").map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}-Q${q}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: "Form parse failed" });
    }

    try {
      const email = Array.isArray(fields.email) ? fields.email[0] : fields.email;
      if (!email) return res.status(400).json({ error: "Missing email" });

      const rawClientId = Array.isArray(fields.clientId)
        ? fields.clientId[0]
        : fields.clientId || null;

      // ✅ Fetch user with role + default client
      const { data: user, error: userErr } = await supabaseAdmin
        .from("app_users")
        .select("id, default_client_id, role")
        .eq("email", email)
        .single();

      if (userErr || !user) {
        return res.status(404).json({ error: "User not found" });
      }

      const userId = user.id;
      const role = user.role || "user";

      let clientId = user.default_client_id;

      // ✅ Accountant-aware: validate clientId against user_clients
      if (role === "accountant" && rawClientId) {
        const { data: links, error: linkErr } = await supabaseAdmin
          .from("user_clients")
          .select("client_id")
          .eq("user_id", userId)
          .eq("client_id", rawClientId);

        if (linkErr) {
          console.warn(
            "user_clients lookup failed (non-fatal):",
            linkErr.message
          );
        } else if (links && links.length > 0) {
          clientId = rawClientId;
        }
      }

      if (!clientId) {
        return res.status(400).json({ error: "No client associated with user" });
      }

      const uploaded = Array.isArray(files.files)
        ? files.files
        : [files.files].filter(Boolean);
      if (!uploaded.length) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const results = [];
      const failures = [];

      for (const file of uploaded) {
        try {
          const buffer = fs.readFileSync(file.filepath);
          const originalName =
            file.originalFilename || file.newFilename || "upload";
          const contentType = file.mimetype || "application/octet-stream";
          const objectName = `${uuid()}-${originalName}`;
          const storagePath = `statements/${clientId}/${objectName}`;

          const { error: uploadErr } = await supabaseAdmin.storage
            .from("statements")
            .upload(storagePath, buffer, { contentType, upsert: false });

          if (uploadErr) {
            throw new Error(`Storage upload failed: ${uploadErr.message}`);
          }

          const rows = parseFileBuffer(originalName, buffer);
          const reversalPairs = detectReversalPairs(rows);
          const nowIso = new Date().toISOString();

          const normalized = rows
            .map((r, i) =>
              normalizeRow(r, i, clientId, userId, nowIso, reversalPairs)
            )
            .filter(Boolean);

          if (!normalized.length) {
            failures.push({
              file: originalName,
              error: "No valid transactions",
            });
            continue;
          }

          const totalAmount = normalized.reduce(
            (sum, r) => sum + (r.amount ?? 0),
            0
          );
          const accountNumber = normalized[0].account_number;
          const sortCode = normalized[0].sort_code;

          // ✅ Insert statement
          const { data: statement, error: stmtErr } = await supabaseAdmin
            .from("statements")
            .insert({
              client_id: clientId,
              uploaded_at: nowIso,
              amount: totalAmount,
              description: originalName,
              transaction_type: "bulk",
              account_number: accountNumber,
              sort_code: sortCode,
            })
            .select("*")
            .single();

          if (stmtErr) {
            throw new Error(`Statement insert failed: ${stmtErr.message}`);
          }

          // ✅ Use statement_id_uuid for transactions
          const txPayload = normalized.map((r) => ({
            ...r,
            statement_id_uuid: statement.id_uuid,
          }));

          const { error: txErr } = await supabaseAdmin
            .from("transactions")
            .insert(txPayload);
          if (txErr) {
            throw new Error(`Transaction insert failed: ${txErr.message}`);
          }

          const revenue = txPayload
            .filter((r) => r.amount > 0 && !r.is_reversal)
            .reduce((s, r) => s + r.amount, 0);

          const expenses = txPayload
            .filter((r) => r.amount < 0 && !r.is_reversal)
            .reduce((s, r) => s + r.amount, 0);

          const netProfit = revenue + expenses;

          const sortedDates = txPayload
            .map((r) => r.date)
            .filter(Boolean)
            .sort();
          const periodStart = sortedDates[0] || null;
          const periodEnd = sortedDates[sortedDates.length - 1] || null;

          // ✅ Insert into reports (no category breakdown — unified engine handles categories later)
          await supabaseAdmin.from("reports").insert({
            client_id: clientId,
            user_id: userId,
            type: "bulk",
            period_start: periodStart,
            period_end: periodEnd,
            summary: {
              total: txPayload.length,
              revenue,
              expenses,
              net_profit: netProfit,
              category_breakdown: {}, // unified APIs compute categories
              file_path: storagePath,
              account_number: accountNumber,
              sort_code: sortCode,
              missing_dates: txPayload.filter((r) => !r.date).length,
            },
            created_at: nowIso,
          });

          // ✅ Forecast stub (unchanged behaviour)
          const nextQuarter = quarterFromDateStr(
            periodEnd || toISODate(new Date())
          );

          await supabaseAdmin.from("forecasts").insert({
            client_id: clientId,
            user_id: userId,
            quarter: nextQuarter,
            revenue: revenue * 1.1,
            expenses: expenses * 1.05,
            net_profit: netProfit * 1.1,
            method: "heuristic",
            source_statement_id: statement.id,
            created_at: nowIso,
          });

          // ✅ Dashboard metrics RPC (non‑fatal)
          try {
            const { error: rpcErr } = await supabaseAdmin.rpc(
              "update_dashboard_metrics",
              { client_id: clientId }
            );
            if (rpcErr) {
              console.warn("Dashboard RPC failed (non-fatal):", rpcErr.message);
            }
          } catch (e) {
            console.warn(
              "Dashboard RPC invoke error (non-fatal):",
              e?.message || e
            );
          }

          // ✅ Mark statement as complete
          await supabaseAdmin
            .from("statements")
            .update({ status: txPayload.length ? "complete" : "empty" })
            .eq("id", statement.id);

          // ✅ Audit log
          await supabaseAdmin.from("audit").insert([
            {
              client_id: clientId,
              user_id: userId,
              action: "UPLOAD_STATEMENT",
              details: `File: ${originalName}, Transactions: ${txPayload.length}, Revenue: ${revenue}, Expenses: ${expenses}, Net: ${netProfit}`,
              created_at: nowIso,
            },
          ]);

          // ✅ Push result for this file
          results.push({
            file: originalName,
            storage_path: storagePath,
            statement_id: statement.id,
            transactions: txPayload.length,
            revenue,
            expenses,
            net_profit: netProfit,
            account_number: accountNumber,
            sort_code: sortCode,
            period_start: periodStart,
            period_end: periodEnd,
          });
        } catch (fileErr) {
          console.error("❌ File ingestion failed:", fileErr.message);
          failures.push({
            file: file.originalFilename,
            error: fileErr.message,
          });
        }
      }

      // ✅ Final response
      return res.status(200).json({
        message: "Upload and ingestion complete",
        results,
        failures,
      });
    } catch (e) {
      console.error("❌ Unexpected error:", e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
