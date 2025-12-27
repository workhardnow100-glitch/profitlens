// pages/api/accountant/client-overview.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  // ⭐ Normalize role
  const role = (session.user.role || "").toUpperCase();
  const accountantEmail = session.user.email.toLowerCase();
  const actingAs = session.user.actingAsClientId;

  const { clientId } = req.body || {};
  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  // ⭐ Founder/Admin bypass
  if (!["ADMIN", "FOUNDER"].includes(role)) {

    // ⭐ Only accountants allowed
    if (role !== "ACCOUNTANT") {
      return res
        .status(403)
        .json({ error: "Only accountants can view client overviews" });
    }

    // ⭐ Accountant must be acting as a client
    if (!actingAs) {
      return res.status(403).json({
        error: "You must select a client before viewing their overview",
      });
    }

    // ⭐ Accountant can only view the client they are acting as
    if (actingAs !== clientId) {
      return res.status(403).json({
        error: "You are not currently acting as this client",
      });
    }

    // ⭐ Validate accountant-client relationship
    const { data: access, error: accessErr } = await supabaseAdmin
      .from("accountant_clients")
      .select("client_id")
      .eq("accountant_email", accountantEmail)
      .eq("client_id", clientId)
      .maybeSingle();

    if (accessErr) {
      console.error("Accountant access check error:", accessErr);
      return res.status(500).json({ error: "Failed to validate access" });
    }

    if (!access) {
      return res.status(403).json({
        error: "You do not have permission to view this client",
      });
    }
  }

  try {
    // Fetch client profile
    // ⭐ Fetch client profile from clients table (NOT app_users)
const { data: client, error: clientErr } = await supabaseAdmin
  .from("clients")
  .select("*")
  .eq("id", clientId)
  .maybeSingle();

if (clientErr) {
  console.error("Client fetch error:", clientErr);
  return res.status(500).json({ error: "Failed to load client" });
}

if (!client) {
  return res.status(404).json({ error: "Client not found" });
}


    // Compute financials
    const { data: transactions, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, is_reversal")
      .eq("client_id", clientId);

    if (txErr) {
      console.error("Transactions fetch error:", txErr);
      return res.status(500).json({ error: "Failed to load transactions" });
    }

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const tx of transactions ?? []) {
      if (tx.is_reversal) continue;
      const amt = tx.amount !== null ? Number(tx.amount) : 0;
      if (amt > 0) totalRevenue += amt;
      else if (amt < 0) totalExpenses += -amt;
    }

    const netProfit = totalRevenue - totalExpenses;

    // Fetch last submissions
    const getLastSubmission = async (table) => {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select("id, period_start, period_end, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error(`Error fetching last from ${table}:`, error);
        return null;
      }
      return data || null;
    };

    const [lastVat, lastSa, lastCis, lastCt] = await Promise.all([
      getLastSubmission("vat_submissions"),
      getLastSubmission("sa_submissions"),
      getLastSubmission("cis_submissions"),
      getLastSubmission("ct_submissions"),
    ]);

    // Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: accountantEmail,
        action: "ACCOUNTANT_VIEW_CLIENT_OVERVIEW",
        details: `Viewed overview for client ${clientId}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({
      success: true,
      client: {
        id: client.id,
        clientId: client.client_id,
        email: client.email,
        name: client.name,
        businessName: client.business_name,
        subscriptionStatus: client.subscription_status,
        createdAt: client.created_at,
      },
      financials: {
        totalRevenue,
        totalExpenses,
        netProfit,
      },
      submissions: {
        vat: lastVat,
        sa: lastSa,
        cis: lastCis,
        ct: lastCt,
      },
    });
  } catch (err) {
    console.error("Accountant client overview error:", err);
    return res.status(500).json({ error: "Failed to load client overview" });
  }
}
