import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, periodStart, periodEnd } = req.body;
  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    // 1️⃣ Get client OAuth token
    const { data: tokenData, error: tokenError } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("client_id", clientId)
      .single();

    if (tokenError || !tokenData) throw new Error("HMRC token not found");

    const accessToken = tokenData.access_token;

    // 2️⃣ Fetch transactions & calculate boxes
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    // Example VAT box calculation (adjust to your rules)
    const boxes = {
      vat_due_sales: transactions.reduce((a, t) => a + (t.vat_amount || 0), 0),
      vat_reclaimed: 0, // replace with actual logic
      // add other boxes 3-9 as needed
    };

    // 3️⃣ Build HMRC payload
    const payload = {
      periodKey: `A${periodStart.replace(/-/g, "")}`, // example periodKey
      vatDueSales: boxes.vat_due_sales,
      vatReclaimedCurrPeriod: boxes.vat_reclaimed,
      // map other boxes as per HMRC spec
      // e.g., totalVatDue, totalVatReclaimed, netVatDue, etc.
      fromDate: periodStart,
      toDate: periodEnd,
    };

    // 4️⃣ Submit to HMRC sandbox
    const hmrcRes = await fetch(
      "https://test-api.service.hmrc.gov.uk/organisations/vat/{vrn}/returns",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/vnd.hmrc.1.0+json",
        },
        body: JSON.stringify(payload),
      }
    );

    const hmrcData = await hmrcRes.json();
    if (!hmrcRes.ok) throw new Error(JSON.stringify(hmrcData));

    // 5️⃣ Lock transactions only if HMRC submission succeeds
    const { error: lockError } = await supabase
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (lockError) throw new Error(lockError.message);

    // 6️⃣ Return success
    return res.status(200).json({ success: true, hmrcResponse: hmrcData });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
