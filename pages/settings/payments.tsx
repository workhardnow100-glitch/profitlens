import { useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";

type PaymentSettingsResponse = {
  stripeAccountId: string | null;
  stripeStatus: "not_connected" | "pending" | "verified" | "restricted";
  payoutsEnabled: boolean;
  bankLast4: string | null;
  bankSortCode: string | null;
  payoutSchedule: string | null;
  nextPayoutDate: string | null;
  lastPayoutAmount: number | null;
  lastPayoutDate: string | null;
  platformFeePercent: number | null;
  platformFeeMin: number | null;
  platformFeeMax: number | null;
  paymentMethods: {
    card: boolean;
    applePay: boolean;
    googlePay: boolean;
    bankTransfer: boolean;
    payByLink: boolean;
  };
  webhook: {
    lastEventAt: string | null;
    lastErrorAt: string | null;
    errorCount: number;
  };
};

export default function PaymentSettingsPage() {
  const { user, isFounder, isAdmin } = useUser();

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [savingMethods, setSavingMethods] = useState(false);
  const [savingFees, setSavingFees] = useState(false);
  const [data, setData] = useState<PaymentSettingsResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/payments/settings");
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error("Failed to load payment settings", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleConnectStripe = async () => {
    try {
      setConnecting(true);
      const res = await fetch("/api/payments/connect", { method: "POST" });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      }
    } catch (e) {
      console.error("Failed to start Stripe Connect", e);
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveMethods = async () => {
    if (!data) return;
    try {
      setSavingMethods(true);
      await fetch("/api/payments/update-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.paymentMethods),
      });
    } catch (e) {
      console.error("Failed to save payment methods", e);
    } finally {
      setSavingMethods(false);
    }
  };

  const handleSaveFees = async () => {
    if (!data) return;
    try {
      setSavingFees(true);
      await fetch("/api/payments/update-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformFeePercent: data.platformFeePercent,
          platformFeeMin: data.platformFeeMin,
          platformFeeMax: data.platformFeeMax,
        }),
      });
    } catch (e) {
      console.error("Failed to save platform fees", e);
    } finally {
      setSavingFees(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading payment settings…</div>;
  }

  if (!data) {
    return <div className="p-6 text-red-600">Failed to load payment settings.</div>;
  }

  const statusLabel =
    data.stripeStatus === "not_connected"
      ? "Not connected"
      : data.stripeStatus === "pending"
      ? "Pending verification"
      : data.stripeStatus === "verified"
      ? "Verified"
      : "Restricted";

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* Hero / Value Explainer */}
      <section className="bg-slate-900 text-white rounded-xl p-6 space-y-3">
        <h1 className="text-2xl font-semibold">
          Get Paid Faster. Get Paid Automatically.
        </h1>
        <p className="text-slate-200">
          ProfitLens connects your invoices, Stripe payments, and payouts into one cockpit.
          When your customers pay, Stripe deposits funds directly into your bank account
          — ProfitLens orchestrates everything and keeps your ledger perfectly reconciled.
        </p>
        <ul className="list-disc list-inside text-slate-200 space-y-1">
          <li>No manual reconciliation or spreadsheets.</li>
          <li>Every charge, fee, refund, and payout is tracked automatically.</li>
          <li>Your accountant gets a complete, audit‑ready view without chasing you.</li>
        </ul>
      </section>

      {/* Stripe Connect Status */}
      <section className="border rounded-xl p-6 space-y-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Stripe Connect</h2>
            <p className="text-sm text-slate-600">
              Connect Stripe to receive invoice payments directly into your bank account.
              ProfitLens never holds your funds — we just keep everything in sync.
            </p>
          </div>
          <span className="px-3 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
            Status: {statusLabel}
          </span>
        </div>

        {data.stripeStatus === "not_connected" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Once connected, Stripe will handle identity verification and payouts. ProfitLens
              will automatically match every payment to the correct invoice and client.
            </p>
            <button
              onClick={handleConnectStripe}
              disabled={connecting}
              className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {connecting ? "Redirecting to Stripe…" : "Connect Stripe Account"}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Stripe Account ID:</span>{" "}
                {data.stripeAccountId || "—"}
              </p>
              <p>
                <span className="font-medium">Payouts Enabled:</span>{" "}
                {data.payoutsEnabled ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-medium">Bank Account:</span>{" "}
                {data.bankLast4 ? `•••• ${data.bankLast4}` : "Not set"}
              </p>
              <p>
                <span className="font-medium">Payout Schedule:</span>{" "}
                {data.payoutSchedule || "Default"}
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Next Payout:</span>{" "}
                {data.nextPayoutDate || "—"}
              </p>
              <p>
                <span className="font-medium">Last Payout:</span>{" "}
                {data.lastPayoutAmount
                  ? `£${(data.lastPayoutAmount / 100).toFixed(2)} on ${
                      data.lastPayoutDate || "—"
                    }`
                  : "—"}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleConnectStripe}
                  className="px-3 py-1.5 rounded-md border text-xs font-medium"
                >
                  Update Stripe Details
                </button>
                <a
                  href="https://dashboard.stripe.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-md border text-xs font-medium"
                >
                  Open Stripe Dashboard
                </a>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Invoicing & Recurring Value Explainer */}
      <section className="border rounded-xl p-6 space-y-3 bg-slate-50">
        <h2 className="text-lg font-semibold">Why use ProfitLens invoicing?</h2>
        <p className="text-sm text-slate-700">
          ProfitLens doesn’t just send invoices — it closes the loop. Every invoice, payment,
          fee, refund, and payout is tied together in your Transactions Ledger and Tax Hub.
        </p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>
            <span className="font-medium">Smart matching:</span> Payments are matched to invoices
            using amount, reference, metadata, email, and timing.
          </li>
          <li>
            <span className="font-medium">Recurring invoicing:</span> Set up weekly, monthly, or
            custom recurring invoices — ProfitLens generates, sends, and tracks them automatically.
          </li>
          <li>
            <span className="font-medium">Payment links:</span> Every invoice includes a secure
            payment link so customers can pay instantly.
          </li>
          <li>
            <span className="font-medium">Automatic reminders:</span> Reduce late payments with
            pre‑due and post‑due reminders.
          </li>
          <li>
            <span className="font-medium">Audit‑ready:</span> Every invoice has a full timeline:
            created, sent, viewed, paid, matched, reconciled.
          </li>
        </ul>
      </section>

      {/* Payment Methods */}
      <section className="border rounded-xl p-6 space-y-4 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invoice Payment Methods</h2>
          <button
            onClick={handleSaveMethods}
            disabled={savingMethods}
            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingMethods ? "Saving…" : "Save Methods"}
          </button>
        </div>
        <p className="text-sm text-slate-700">
          Choose how your customers can pay your ProfitLens invoices. These options are applied
          to payment links and checkout flows.
        </p>
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          {[
            { key: "card", label: "Card payments" },
            { key: "applePay", label: "Apple Pay" },
            { key: "googlePay", label: "Google Pay" },
            { key: "bankTransfer", label: "Bank transfer" },
            { key: "payByLink", label: "Pay by link" },
          ].map((m) => (
            <label key={m.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={(data.paymentMethods as any)[m.key]}
                onChange={(e) =>
                  setData((prev) =>
                    prev
                      ? {
                          ...prev,
                          paymentMethods: {
                            ...prev.paymentMethods,
                            [m.key]: e.target.checked,
                          },
                        }
                      : prev
                  )
                }
              />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Platform Fees — Founder/Admin Only */}
      {(isFounder || isAdmin) && (
        <section className="border rounded-xl p-6 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Platform Fees</h2>
            <button
              onClick={handleSaveFees}
              disabled={savingFees}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingFees ? "Saving…" : "Save Fees"}
            </button>
          </div>

          <p className="text-sm text-slate-700">
            If you choose to charge a platform fee on payments processed through ProfitLens,
            it will be automatically deducted before funds reach your bank account.
          </p>

          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Fee %</label>
              <input
                type="number"
                step="0.1"
                value={data.platformFeePercent ?? ""}
                onChange={(e) =>
                  setData((prev) =>
                    prev ? { ...prev, platformFeePercent: Number(e.target.value) } : prev
                  )
                }
                className="w-full border rounded-md px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Min fee (£)</label>
              <input
                type="number"
                step="0.01"
                value={data.platformFeeMin ?? ""}
                onChange={(e) =>
                  setData((prev) =>
                    prev ? { ...prev, platformFeeMin: Number(e.target.value) } : prev
                  )
                }
                className="w-full border rounded-md px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Max fee (£)</label>
              <input
                type="number"
                step="0.01"
                value={data.platformFeeMax ?? ""}
                onChange={(e) =>
                  setData((prev) =>
                    prev ? { ...prev, platformFeeMax: Number(e.target.value) } : prev
                  )
                }
                className="w-full border rounded-md px-2 py-1 text-sm"
              />
            </div>
          </div>
        </section>
      )}

      {/* Webhook Health */}
      <section className="border rounded-xl p-6 space-y-3 bg-slate-50">
        <h2 className="text-lg font-semibold">Stripe Webhook Health</h2>
        <p className="text-sm text-slate-700">
          ProfitLens listens to Stripe webhooks for charges, payouts, refunds, and disputes.
          If webhooks stop flowing, your ledger and payouts may fall out of sync.
        </p>
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <p>
            <span className="font-medium">Last event:</span>{" "}
            {data.webhook.lastEventAt || "—"}
          </p>
          <p>
            <span className="font-medium">Last error:</span>{" "}
            {data.webhook.lastErrorAt || "None"}
          </p>
          <p>
            <span className="font-medium">Error count:</span>{" "}
            {data.webhook.errorCount}
          </p>
        </div>
      </section>

      {/* Footer reassurance */}
      <section className="text-sm text-slate-600">
        ProfitLens handles the heavy lifting — Stripe moves the money, we keep every invoice,
        payment, fee, refund, and payout perfectly aligned for you and your accountant.
      </section>
    </div>
  );
}
