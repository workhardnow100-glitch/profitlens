// pages/reports/trial-balance.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrialBalanceTable } from "../../components/trial-balance/TrialBalanceTable";

export default function TrialBalancePage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false); // mobile guidance

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      setClientId(session?.user?.clientId ?? null);
    };

    load();
  }, []);

  if (!clientId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Trial Balance</h1>
        <p className="text-gray-600 mt-2">Loading client data…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* GRID: Left content + Right guidance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT SIDE */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Trial Balance</h1>

            {/* Return to COA */}
            <Link
              href="/setting/chart-of-accounts"
              className="text-sm px-3 py-2 bg-slate-100 border rounded hover:bg-slate-200"
            >
              ← Return to Chart of Accounts
            </Link>
          </div>

          <p className="text-gray-600">
            A summary of all account balances for this client.
          </p>

          <TrialBalanceTable clientId={clientId} />
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
              <h2 className="text-lg font-semibold">Trial Balance Guidance</h2>
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
  const Wrapper = ({ children }) =>
    innerOnly ? (
      <>{children}</>
    ) : (
      <div className="p-6 bg-white border rounded shadow-sm lg:sticky lg:top-6">
        {children}
      </div>
    );

  return (
    <Wrapper>
      <h2 className="text-xl font-semibold mb-4">Trial Balance</h2>

      <p className="text-sm text-slate-700 mb-3">
        The Trial Balance (TB) is the master checkpoint of your entire accounting
        system. It shows every account with its total debits and credits and
        confirms whether your ledger is mathematically sound.
      </p>

      <h3 className="font-semibold mt-4 mb-2">What this page shows</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Every account in your Chart of Accounts.</li>
        <li>Opening balances (if applicable).</li>
        <li>Total debits and credits for the period.</li>
        <li>Closing balances.</li>
        <li>Debit‑normal vs credit‑normal accounts.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">Why the TB matters</h3>
      <p className="text-sm text-slate-700 mb-2">
        Every major report depends on the TB:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Profit &amp; Loss layout and totals.</li>
        <li>Balance Sheet structure and accuracy.</li>
        <li>VAT / MTD workings.</li>
        <li>Journal validation.</li>
        <li>Year‑end accountant workflows.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">Debits & Credits refresher</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li><strong>Debit</strong> increases assets and expenses.</li>
        <li><strong>Credit</strong> increases liabilities, equity, and income.</li>
      </ul>
      <p className="text-sm font-medium text-slate-900 mb-3">
        Total Debits must always equal Total Credits.
      </p>

      <h3 className="font-semibold mt-4 mb-2">Common imbalance causes</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>One‑sided or incomplete journals.</li>
        <li>Deleted or renamed system accounts.</li>
        <li>Incorrect VAT adjustments.</li>
        <li>Migration/import issues.</li>
        <li>Locked‑period overrides misused.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">How to diagnose issues</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Check recent journals.</li>
        <li>Check system accounts (VAT, Debtors, Creditors, Bank).</li>
        <li>Check imported data.</li>
        <li>Check deleted accounts.</li>
        <li>Check locked‑period overrides.</li>
      </ul>

      <p className="text-sm text-slate-700 mb-3">
        If unsure, invite your accountant or contact ProfitLens support.
      </p>

      <h3 className="font-semibold mt-4 mb-2">Best practices</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Review the TB monthly.</li>
        <li>Check before filing VAT.</li>
        <li>Check before year‑end.</li>
        <li>Use journals to correct mistakes.</li>
        <li>Keep your COA clean and structured.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">Common mistakes</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-4">
        <li>Ignoring small imbalances.</li>
        <li>Posting directly to Retained Earnings.</li>
        <li>Misusing VAT Control.</li>
        <li>Deleting accounts with history.</li>
        <li>Posting one‑sided journals.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">The goal</h3>
      <p className="text-sm text-slate-800">
        A balanced Trial Balance means your books are healthy, your reports are
        accurate, your VAT returns are correct, and your year‑end will be smooth.
      </p>
    </Wrapper>
  );
}
