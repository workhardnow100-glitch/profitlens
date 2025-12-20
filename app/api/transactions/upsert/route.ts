import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      id,
      clientId,
      date,
      description,
      amount,
      category,
      vat_rate,
      vat_amount,
      cis_type,

      // ✅ FLAT ASSET FIELDS (match DB)
      assetdisposaltype,
      assetpurchaseprice,
      assetcapitalclaimed,
      assettwdv,
      assetbalancingcharge,
      assetbalancingallowance,

      // ✅ CT fields
      includedinct,          // ✅ manual override or direct toggle
      manualctoverride,      // ✅ locks CT state
      auto_ct,               // ✅ auto‑CT hint from category change

      // ✅ MTD metadata
      mtdMetadata,
    } = body;

    const updateData: any = {};

    // ✅ BASIC FIELDS
    if (clientId !== undefined) updateData.client_id = clientId;
    if (date !== undefined) updateData.date = date;
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = amount;
    if (category !== undefined) updateData.business_category = category;

    if (vat_rate !== undefined) updateData.vat_rate = vat_rate;
    if (vat_amount !== undefined) updateData.vat_amount = vat_amount;
    if (cis_type !== undefined) updateData.cis_type = cis_type;

    // ✅ ASSET DISPOSAL FIELDS (flat, lowercase to match schema)
    if (assetdisposaltype !== undefined)
      updateData.assetdisposaltype = assetdisposaltype;

    if (assetpurchaseprice !== undefined)
      updateData.assetpurchaseprice = assetpurchaseprice;

    if (assetcapitalclaimed !== undefined)
      updateData.assetcapitalclaimed = assetcapitalclaimed;

    if (assettwdv !== undefined)
      updateData.assettwdv = assettwdv;

    if (assetbalancingcharge !== undefined)
      updateData.assetbalancingcharge = assetbalancingcharge;

    if (assetbalancingallowance !== undefined)
      updateData.assetbalancingallowance = assetbalancingallowance;

    // ✅ FIRST: Fetch existing row so we can respect manual override
    let existing: any = {}; // ✅ FIXED — allow object, not null
    if (id) {
      const { data: existingRow } = await supabase
        .from("transactions")
        .select("manualctoverride, includedinct")
        .eq("id", id)
        .single();

      existing = existingRow ?? {}; // ✅ FIXED — safe fallback
    }

    // ✅ MANUAL OVERRIDE (user clicked CT toggle)
    if (includedinct !== undefined) {
      updateData.includedinct = includedinct;
    }

    if (manualctoverride !== undefined) {
      updateData.manualctoverride = manualctoverride;
    }

    // ✅ AUTO‑CT LOGIC (only applies if user has NOT overridden)
    if (auto_ct !== undefined) {
      const userHasOverridden = existing?.manualctoverride === true;

      if (!userHasOverridden) {
        updateData.includedinct = auto_ct;
      }
    }

    // ✅ MTD METADATA FIELDS (lowercase to match schema)
    if (mtdMetadata) {
      if (mtdMetadata.source !== undefined)
        updateData.source = mtdMetadata.source;

      if (mtdMetadata.sourceId !== undefined)
        updateData.sourceid = mtdMetadata.sourceId;

      if (mtdMetadata.attachmentUrl !== undefined)
        updateData.attachmenturl = mtdMetadata.attachmentUrl;

      if (mtdMetadata.includedInVAT !== undefined)
        updateData.includedinvat = mtdMetadata.includedInVAT;

      if (mtdMetadata.includedInCIS !== undefined)
        updateData.includedincis = mtdMetadata.includedInCIS;

      if (mtdMetadata.includedInCT !== undefined)
        updateData.includedinct = mtdMetadata.includedInCT;

      if (mtdMetadata.includedInSA !== undefined)
        updateData.includedinsa = mtdMetadata.includedInSA;
    }

    // ✅ UPSERT
    let result;

    if (id) {
      result = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("transactions")
        .insert(updateData)
        .select()
        .single();
    }

    if (result.error) {
      console.error("Supabase error:", result.error);
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ transaction: result.data });
  } catch (err: any) {
    console.error("Upsert error:", err);
    return NextResponse.json(
      { error: "Failed to upsert transaction" },
      { status: 500 }
    );
  }
}
