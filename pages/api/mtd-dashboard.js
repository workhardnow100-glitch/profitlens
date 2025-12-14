// pages/api/mtd-dashboard.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

// 🔧 replace with your DB helpers
import {
  getTransactionsByClient,
  updateTransactionCategory,
  lockVatPeriod,
  checkVatLock
} from "../../lib/db";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthenticated" });
  }

  const { action, clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: "Missing clientId" });
  }

  try {
    switch (action) {
      case "fetchTransactions": {
        const rows = await getTransactionsByClient(clientId);

        // 🔹 Server-side VAT calculation (authoritative)
        const data = rows.map(tx => {
          if (tx.category === "vat") {
            const rate = tx.vat_rate ?? 20;
            return {
              ...tx,
              vat_rate: rate,
              vat_amount: Number((tx.amount * rate / 100).toFixed(2))
            };
          }
          return { ...tx, vat_amount: 0 };
        });

        return res.json({ data });
      }

      case "updateCategory": {
        const { rowId, category } = req.body;
        await updateTransactionCategory(rowId, category);
        return res.json({ success: true });
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
