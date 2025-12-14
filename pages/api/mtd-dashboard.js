import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import {
  getTransactionsByClient,
  updateTransactionCategory, // still available if needed for corrections
  lockVatPeriod,
  checkVatLock
} from "../../lib/db";

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthenticated" });

  const { action, clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  try {
    switch (action) {
      case "fetchTransactions": {
        const rows = await getTransactionsByClient(clientId);

        // 🔹 Auto-classify and calculate VAT per row
        const data = rows.map(tx => {
          let category = tx.category;

          if (!category) {
            if (tx.amount > 0) category = "income";
            else if (tx.amount < 0) category = "expense";
          }

          let vat_amount = 0;
          if (category === "vat" || tx.vat_rate) {
            const rate = tx.vat_rate ?? 20;
            vat_amount = round2(tx.amount * rate / 100);
            category = "vat";
          }

          return { ...tx, category, vat_amount };
        });

        // 🔹 Totals
        const vatDue = data.filter(t => t.category === "vat")
                           .reduce((s, t) => s + t.vat_amount, 0);

        const netSales = data.filter(t => t.category === "vat" && t.amount > 0)
                             .reduce((s, t) => s + t.amount, 0);

        const netPurchases = data.filter(t => t.category === "vat" && t.amount < 0)
                                 .reduce((s, t) => s + Math.abs(t.amount), 0);

        const incomeTotal = data.filter(t => t.category === "income")
                                .reduce((s, t) => s + t.amount, 0);

        const corpProfit = data.filter(t => t.category === "income" || t.category === "expense")
                               .reduce((s, t) => s + t.amount, 0);

        const corpTax = corpProfit > 0 ? round2(corpProfit * 0.19) : 0;

        return res.json({
          data,
          totals: {
            vatDue: round2(vatDue),
            netSales: round2(netSales),
            netPurchases: round2(netPurchases),
            income: round2(incomeTotal),
            corpProfit: round2(corpProfit),
            corpTax
          }
        });
      }

      case "checkLock": {
        const locked = await checkVatLock(clientId);
        return res.json({ locked });
      }

      case "lockVat": {
        await lockVatPeriod(clientId);
        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
