// pages/api/vat/periods.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helpers unchanged...
function fmt(d) {
  return d.toISOString().split("T")[0];
}

function label(start, end) {
  return `${new Date(start).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} → ${new Date(end).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

function generateVatPeriods(stagger, yearsBack = 2) {
  const now = new Date();
  const periods = [];

  const staggerMonths = {
    1: [0, 3, 6, 9],
    2: [1, 4, 7, 10],
    3: [2, 5, 8, 11],
  }[stagger];

  for (let y = now.getFullYear() - yearsBack; y <= now.getFullYear(); y++) {
    for (const m of staggerMonths) {
      const start = new Date(y, m, 16);
      const end = new Date(y, m + 3, 15);

      if (end <= now) {
        periods.push({
          periodStart: fmt(start),
          periodEnd: fmt(end),
          periodLabel: label(fmt(start), fmt(end)),
        });
      }
    }
  }

  return periods.reverse();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ SESSION REQUIRED
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ⭐ Resolve clientId safely
  let clientId = null;

  if (session.user.role === "accountant") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  try {
    // ⭐ Load VAT stagger
    const { data: client } = await supabase
      .from("clients")
      .select("vat_stagger, hmrc_authorized")
      .eq("id", clientId)
      .maybeSingle();

    const stagger = client?.vat_stagger || 1;

    // ⭐ Generate VAT periods
    const vatPeriods = generateVatPeriods(stagger);

    // ⭐ Load VAT payments
    const { data: vatPayments } = await supabase
      .from("vat_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    // ⭐ For each period, call VAT summary engine
    const enriched = [];
    let totalVatOwed = 0;
    let totalVatPaid = 0;

    for (const p of vatPeriods) {
      const summaryRes = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/vat/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            periodStart: p.periodStart,
            periodEnd: p.periodEnd,
          }),
        }
      );

      const summary = await summaryRes.json();

      const owed = summary.boxes?.box5 || 0;
      totalVatOwed += owed;

      enriched.push({
        ...p,
        locked: summary.locked,
        submitted: summary.submitted,
        hmrcAuthorized: client?.hmrc_authorized || false,
        owed,
      });
    }

    // ⭐ Sum VAT payments
    vatPayments.forEach((p) => {
      totalVatPaid += p.direction === "payment" ? p.amount : -p.amount;
    });

    const vatBalance = totalVatOwed - totalVatPaid;

    return res.json({
      vat: enriched,
      vatPayments,
      totalVatOwed,
      totalVatPaid,
      vatBalance,
      vatStagger: stagger,
    });
  } catch (err) {
    console.error("VAT periods error:", err);
    return res.status(500).json({ error: err.message });
  }
}
