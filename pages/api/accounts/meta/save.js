// pages/api/accounts/meta/save.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const {
      clientId,
      periodStart,
      periodEnd,
      directorName,
      approvalDate,
      employeesCurrent,
      employeesPrevious,
      directorsRemCurrent,
      directorsRemPrevious,
      relatedPartyNotes,
      contingentLiabilitiesNotes,
      postBalanceSheetEventsNotes,
      accountingPoliciesOverride,
      smallCompaniesRegimeOverride,
    } = req.body;

    if (!clientId || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: "Missing clientId, periodStart or periodEnd",
      });
    }

    // Ensure row exists
    const { data: rows, error: loadError } = await supabaseAdmin
      .from("client_accounts_periods")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd);

    if (loadError) {
      return res.status(500).json({ success: false, error: loadError.message });
    }

    let existing = rows?.[0] || null;

    if (!existing) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("client_accounts_periods")
        .insert([
          {
            client_id: clientId,
            period_start: periodStart,
            period_end: periodEnd,
          },
        ])
        .select()
        .single();

      if (insertError) {
        return res.status(500).json({ success: false, error: insertError.message });
      }

      existing = inserted;
    }

    // Build update object
    const update = {
      director_name: directorName,
      accounts_approval_date: approvalDate,
      employees_current_year: employeesCurrent,
      employees_previous_year: employeesPrevious,
      directors_remuneration: directorsRemCurrent,
      directors_remuneration_previous: directorsRemPrevious,
      related_party_notes: relatedPartyNotes,
      contingent_liabilities_notes: contingentLiabilitiesNotes,
      post_balance_sheet_events: postBalanceSheetEventsNotes,
      accounting_policies_override: accountingPoliciesOverride,
      small_companies_regime_override: smallCompaniesRegimeOverride,
      updated_at: new Date().toISOString(),
    };

    // Remove undefined
    Object.keys(update).forEach((k) => {
      if (update[k] === undefined) delete update[k];
    });

    // Update row
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("client_accounts_periods")
      .update(update)
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ success: false, error: updateError.message });
    }

    return res.status(200).json({ success: true, meta: updated });
  } catch (err) {
    console.error("ACCOUNTS META SAVE ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
