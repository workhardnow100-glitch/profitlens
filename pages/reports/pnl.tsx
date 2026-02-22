// pages/reports/pnl.tsx
import { useEffect, useState } from "react";
import Link from "next/link";

type PnlSummary = {
  revenue: number;
  cost_of_sales: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
  revenue_mtd: number;
  revenue_ytd: number;
  expenses_mtd: number;
  expenses_ytd: number;
  net_profit_mtd: number;
  net_profit_ytd: number;
};

type PnlResponse = {
  summary: PnlSummary;
};

export default function PnlReportPage() {
  const [data, setData] = useState<PnlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false); // mobile guidance

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/reports/pnl");
        if (!res.ok) throw new Error("Failed to load P&L");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? "Failed to load P&L");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const summary = data?.summary;

  return (
    <div className="p-6 space-y-6">
      {/* GRID: Left content + Right guidance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT SIDE */}
        <div className="lg:col-span-2 space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Profit &amp; Loss</h1>
              <p className="text-gray-600 text-sm">
                Revenue, expenses, and profit for this client.
              </p>
            </div>

            {/* Return to Trial Balance */}
            <Link
              href="/reports/trial-balance"
              className="text-sm px-3 py-2 bg-slate-100 border rounded hover:bg-slate-200"
            >
              ← Return to Trial Balance
            </Link>
          </header>

          {loading && <p>Loading P&amp;L…</p>}
          {error && (
            <p className="text-red-600 text-sm">Error: {error}</p>
          )}

          {!loading && !error && summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Summary (YTD)">
                <Row label="Revenue" value={summary.revenue} />
                <Row label="Cost of Sales" value={summary.cost_of_sales} />
                <Row label="Gross Profit" value={summary.gross_profit} />
                <Row
                  label="Operating Expenses"
                  value={summary.operating_expenses}
                />
                <Row
                  label="Net Profit"
                  value={summary.net_profit}
                  bold
                />
              </Card>

              <Card title="Period Performance">
                <Row
                  label="Revenue (MTD)"
                  value={summary.revenue_mtd}
                />
                <Row
                  label="Expenses (MTD)"
                  value={summary.expenses_mtd}
                />
                <Row
                  label="Net Profit (MTD)"
                  value={summary.net_profit_mtd}
                  bold
                />
                <Row
                  label="Revenue (YTD)"
                  value={summary.revenue_ytd}
                />
                <Row
                  label="Expenses (YTD)"
                  value={summary.expenses_ytd}
                />
                <Row
                  label="Net Profit (YTD)"
                  value={summary.net_profit_ytd}
                  bold
                />
              </Card>
            </div>
          )}
        </div>

        {/* RIGHT SIDE — Guidance Panel (Desktop) */}
        <aside className="hidden lg:block lg:col-span-1">
          <GuidancePanel />
        </aside>
      </div>

      {/* MOBILE HELP BUTTON */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-30 px-4 py-2 rounded-full bg-blue-600 text-white shadow-lg"
        onClick={() => setShowHelp(true)}
      >
        ?
      </button>

      {/* MOBILE SLIDE-OUT PANEL */}
      {showHelp && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black bg-opacity-40"
            onClick={() => setShowHelp(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Profit &amp; Loss guidance
              </h2>
              <button
                className="text-sm px-3 py-1 border rounded"
                onClick={() => setShowHelp(false)}
              >
                Close
              </button>
            </div>
            <GuidancePanel innerOnly />
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------
   GUIDANCE PANEL
-------------------------------------------- */
function GuidancePanel({ innerOnly }: { innerOnly?: boolean }) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    innerOnly ? (
      <>{children}</>
    ) : (
      <div className="p-6 bg-white border rounded shadow-sm lg:sticky lg:top-6">
        {children}
      </div>
    );

  return (
    <Wrapper>
      <h2 className="text-xl font-semibold mb-4">Profit &amp; Loss</h2>

      <p className="text-sm text-slate-700 mb-3">
        The Profit &amp; Loss (P&amp;L) report shows how much this client has
        earned and spent over a period, and what profit or loss remains after
        costs and expenses.
      </p>

      <h3 className="font-semibold mt-4 mb-2">What this page shows</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Total revenue and cost of sales.</li>
        <li>Gross profit (revenue minus cost of sales).</li>
        <li>Operating expenses.</li>
        <li>Net profit for the year to date.</li>
        <li>Month‑to‑date and year‑to‑date performance.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">How to read it</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>
          <strong>Revenue</strong> – income from sales and other operating
          activities.
        </li>
        <li>
          <strong>Cost of Sales</strong> – direct costs linked to generating
          revenue.
        </li>
        <li>
          <strong>Gross Profit</strong> – revenue minus cost of sales.
        </li>
        <li>
          <strong>Operating Expenses</strong> – overheads and running costs.
        </li>
        <li>
          <strong>Net Profit</strong> – final profit after all expenses.
        </li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">Links to other reports</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>
          The P&amp;L is built from the same accounts you see in the Trial
          Balance.
        </li>
        <li>
          Net profit flows into equity on the Balance Sheet (usually Retained
          Earnings).
        </li>
        <li>
          Revenue and expense classifications are controlled by your Chart of
          Accounts.
        </li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">MTD vs YTD</h3>
      <p className="text-sm text-slate-700 mb-2">
        This page shows both:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>
          <strong>MTD</strong> – performance for the current month.
        </li>
        <li>
          <strong>YTD</strong> – performance from the start of the year to
          today.
        </li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        Use these to compare short‑term performance with the overall year.
      </p>

      <h3 className="font-semibold mt-4 mb-2">Best practices</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Review the P&amp;L monthly to track performance.</li>
        <li>Check that revenue and expenses are posted to the right accounts.</li>
        <li>Use journals to correct misclassifications.</li>
        <li>Align your P&amp;L layout with how you manage the business.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">Common mistakes</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-4">
        <li>Posting balance sheet items (e.g. loans, assets) to P&amp;L.</li>
        <li>Misclassifying cost of sales as overheads, or vice versa.</li>
        <li>Using vague accounts like “Miscellaneous” too often.</li>
        <li>Ignoring negative margins or unusual swings.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">The goal</h3>
      <p className="text-sm text-slate-800">
        The P&amp;L should give a clear, trustworthy view of how the business is
        performing, so you and your accountant can make confident decisions on
        pricing, costs, and growth.
      </p>
    </Wrapper>
  );
}

/* -------------------------------------------
   CARD + ROW COMPONENTS
-------------------------------------------- */
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  const safeValue = Number(value ?? 0);

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={bold ? "font-semibold text-gray-900" : "text-gray-900"}>
        £
        {safeValue.toLocaleString("en-GB", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    </div>
  );
}
