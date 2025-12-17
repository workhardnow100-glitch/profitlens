// ✅ GET — dashboard data (raw, matches Profile exactly)
if (req.method === "GET") {
  try {
    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, amount, description, business_category, account_number, sort_code, storage_path, type, is_reversal"
      )
      .eq("client_id", clientId)
      .order("date", { ascending: false });

    if (error) throw error;

    const monthly = {};
    const recent = [];
    const categoryBreakdown = {};

    for (const tx of transactions ?? []) {
      if (tx.is_reversal) continue;

      const date = new Date(tx.date);
      if (isNaN(date.getTime())) continue;

      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      if (!monthly[monthKey]) {
        monthly[monthKey] = { revenue: 0, expenses: 0 };
      }

      const amount = tx.amount !== null ? parseFloat(tx.amount) : 0;

      const category = tx.business_category?.trim() || "Uncategorised";

      if (!categoryBreakdown[category]) categoryBreakdown[category] = 0;

      recent.push({
        id: tx.id,
        date: date.toISOString().slice(0, 10),
        amount,
        description: tx.description || "",
        category,
        accountNumber: tx.account_number || "-",
        sortCode: tx.sort_code || "-",
        storagePath: tx.storage_path || null,
      });

      if (amount > 0) {
        monthly[monthKey].revenue += amount;
      } else if (amount < 0) {
        monthly[monthKey].expenses += -amount;
        categoryBreakdown[category] += -amount;
      }
    }

    const months = Object.keys(monthly).sort();
    const revenue = months.map((m) => monthly[m].revenue);
    const expenses = months.map((m) => monthly[m].expenses);
    const totalRevenue = revenue.reduce((a, b) => a + b, 0);
    const totalExpenses = expenses.reduce((a, b) => a + b, 0);
    const netProfit = totalRevenue - totalExpenses;

    return res.status(200).json({
      stats: [
        { label: "Total Revenue", value: totalRevenue.toFixed(2) },
        { label: "Total Expenses", value: totalExpenses.toFixed(2) },
        { label: "Net Profit", value: netProfit.toFixed(2) },
      ],
      series: { months, revenue, expenses },
      recent,
      breakdown: categoryBreakdown,
      categories: Object.keys(categoryBreakdown),
    });
  } catch (err) {
    console.error("Dashboard API error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load dashboard data" });
  }
}
