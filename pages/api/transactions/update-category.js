import { NextResponse } from "next/server";
import { CATEGORIES } from "../../lib/constants/categories";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";
import { createClient } from "@/utils/supabase/server";

export async function POST(req) {
  try {
    const supabase = createClient();
    const { transactionId, category } = await req.json();

    // ✅ Validate category exists in our constants
    const allCategories = [
      ...CATEGORIES.income,
      ...CATEGORIES.allowable,
      ...CATEGORIES.disallowable,
      ...CATEGORIES.dla,
      ...CATEGORIES.system,
      ...CATEGORIES.tax,
    ];

    if (!allCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // ✅ Update transaction
    const { error } = await supabase
      .from("transactions")
      .update({ business_category: category })
      .eq("id", transactionId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
