"use client";

import { useEffect, useState } from "react";

type TbRow = {
  account_code: string;
  account_name: string;
  account_type: string;
  hmrc_bucket: string;
  net_amount: number;
  debit: number;
  credit: number;
};

export function TrialBalanceTable({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<TbRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch(`/api/trial-balance?clientId=${clientId}`);
      const json = await res.json();
      setRows(json.rows ?? []);
      setLoading(false);
    };
    load();
  }, [clientId]);

  if (loading) {
    return <div className="text-gray-500">Loading trial balance…</div>;
  }

  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);

  return (
    <div className="overflow-x-auto border rounded-lg bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left py-2 px-3">Code</th>
            <th className="text-left py-2 px-3">Name</th>
            <th className="text-left py-2 px-3">Type</th>
            <th className="text-left py-2 px-3">HMRC Bucket</th>
            <th className="text-right py-2 px-3">Debit</th>
            <th className="text-right py-2 px-3">Credit</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.account_code} className="border-b">
              <td className="py-2 px-3">{r.account_code}</td>
              <td className="py-2 px-3">{r.account_name}</td>
              <td className="py-2 px-3">{r.account_type}</td>
              <td className="py-2 px-3">{r.hmrc_bucket}</td>
              <td className="py-2 px-3 text-right">
                {r.debit.toFixed(2)}
              </td>
              <td className="py-2 px-3 text-right">
                {r.credit.toFixed(2)}
              </td>
            </tr>
          ))}

          <tr className="font-semibold bg-gray-50">
            <td colSpan={4} className="py-2 px-3 text-right">
              Totals
            </td>
            <td className="py-2 px-3 text-right">
              {totalDebit.toFixed(2)}
            </td>
            <td className="py-2 px-3 text-right">
              {totalCredit.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
