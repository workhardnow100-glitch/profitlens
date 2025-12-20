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

      // ✅ NEW FIELDS
      assetDisposal,
      mtdMetadata,
    } = body;

    // ✅ Build update object safely
    const updateData: any = {};

    if (clientId !== undefined) updateData.client_id = clientId;
    if (date !== undefined) updateData.date = date;
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = amount;
    if (category !== undefined) updateData.business_category = category;

    if (vat_rate !== undefined) updateData.vat_rate = vat_rate;
    if (vat_amount !== undefined) updateData.vat_amount = vat_amount;
    if (cis_type !== undefined) updateData.cis_type = cis_type;

    // ✅ ASSET DISPOSAL FIELDS (lowercase to match schema)
    if (assetDisposal) {
      updateData.assetdisposaltype = assetDisposal.assetDisposalType ?? "NONE";
      updateData.assetpurchaseprice = assetDisposal.assetPurchasePrice ?? null;
      updateData.assetcapitalclaimed = assetDisposal.assetCapitalClaimed ?? null;
      updateData.assettwdv = assetDisposal.assetTWDV ?? null;
      updateData.assetbalancingcharge =
        assetDisposal.assetBalancingCharge ?? null;
      updateData.assetbalancingallowance =
        assetDisposal.assetBalancingAllowance ?? null;
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

    // ✅ UPDATE OR INSERT
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
