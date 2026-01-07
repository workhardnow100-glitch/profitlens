// pages/api/sa/analytics.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { CT_MAP } from "../../../lib/constants/ctMap";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ⭐ SESSION REQUIRED
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = (session.user.role || "").toUpperCase();

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Resolve clientId safely
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  const { periodStart, periodEnd } = req.body;

  if (!periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing required fields" });

  // ⭐ Extra guard: prevent absurd ranges for accountants
  if (role === "ACCOUNTANT") {
    const startYear = Number(String(periodStart).split("-")[0]);
    const endYear = Number(String(periodEnd).split("-")[0]);

    if (
      Number.isNaN(startYear) ||
      Number.isNaN(endYear) ||
      startYear < 2000 ||
      endYear > 2100 ||
      endYear < startYear
    ) {
      return res.status(400).json({ error: "Invalid period range" });
    }
  }

  try {
    // ⭐ AUDIT LOG — Accountant viewing SA analytics
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_SA_ANALYTICS",
          details: `Viewed SA analytics for ${periodStart} → ${periodEnd}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Load transactions using the REAL schema
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, business_category")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (error) throw error;

    // ⭐ Build lowercase CT_MAP sets
    const MAP = {
      income: new Set(CT_MAP.income.map((c) => c.toLowerCase())),
      allowable: new Set(CT_MAP.allowable.map((c) => c.toLowerCase())),
      disallowable: new Set(CT_MAP.disallowable.map((c) => c.toLowerCase())),
    };

    // ⭐ Filter SA‑relevant transactions using CT_MAP
    const saTx = (tx || []).filter((t) => {
      const cat = (t.business_category || "").toLowerCase();
      return (
        MAP.income.has(cat) ||
        MAP.allowable.has(cat) ||
        MAP.disallowable.has(cat)
      );
    });

    // ⭐ Build monthly buckets
    const buckets = {};

    saTx.forEach((t) => {
      const month = t.date.slice(0, 7); // YYYY-MM

      if (!buckets[month]) {
        buckets[month] = { income: 0, expenses: 0 };
      }

      const amt = Number(t.amount);

      if (amt > 0) buckets[month].income += amt;
      else buckets[month].expenses += Math.abs(amt);
    });

    // ⭐ Convert to array
    const analytics = Object.keys(buckets).map((month) => ({
      month,
      income: buckets[month].income,
      expenses: buckets[month].expenses,
      profit: buckets[month].income - buckets[month].expenses,
    }));

    return res.status(200).json({ analytics });
  } catch (err) {
    console.error("SA analytics error:", err);
    return res.status(500).json({ error: err.message });
  }
}
