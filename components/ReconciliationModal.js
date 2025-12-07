import React, { useState, useMemo } from "react";
import Layout from "../components/layout";
import ReconciliationModal from "../components/ReconciliationModal";

export default function Accountants() {
  const [clients] = useState([
    { id: "acme", name: "Acme Ltd", access: "edit" },
    { id: "bright", name: "BrightCo", access: "view" },
  ]);
  const [activeClientId, setActiveClientId] = useState(clients[0].id);

  const [reconQueue, setReconQueue] = useState([
    {
      id: "txn_001",
      clientId: "acme",
      amount: 120.5,
      date: "2025-09-10",
      status: "unmatched",
      description: "Stripe payout fee",
    },
    {
      id: "txn_002",
      clientId: "acme",
      amount: -58.99,
      date: "2025-09-09",
      status: "needs_review",
      description: "SaaS tools",
    },
  ]);

  const [statements] = useState([
    {
      id: "s_001",
      clientId: "acme",
      name: "HSBC Aug",
      format: "PDF",
      source: "bank@hsbc.com",
      date: "2025-09-01",
    },
    {
      id: "s_002",
      clientId: "bright",
      name: "Barclays Aug",
      format: "CSV",
      source: "noreply@barclays.com",
      date: "2025-09-02",
    },
  ]);

  const [exports] = useState([
    {
      id: "x_001",
      clientId: "acme",
      format: "Xero CSV",
      range: "Aug 2025",
      status: "ready",
    },
    {
      id: "x_002",
      clientId: "bright",
      format: "QuickBooks CSV",
      range: "Aug 2025",
      status: "building",
    },
  ]);

  const [audit] = useState([
    {
      id: "a_001",
      clientId: "acme",
      user: "accountant@firm.com",
      action: "Tagged transaction",
      date: "2025-09-12",
    },
    {
      id: "a_002",
      clientId: "bright",
      user: "owner@bright.com",
      action: "Exported statements",
      date: "2025-09-11",
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);

  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeClientId),
    [clients, activeClientId]
  );

  const reconForClient = reconQueue.filter((r) => r.clientId === activeClientId);
  const statementsForClient = statements.filter(
    (s) => s.clientId === activeClientId
  );
  const exportsForClient = exports.filter((e) => e.clientId === activeClientId);
  const auditForClient = audit.filter((a) => a.clientId === activeClientId);

  const card = "bg-white p-6 rounded-lg shadow-sm border border-slate-200";

  const handleReconcile = async ({ id, tag, clientMatch, note }) => {
    try {
      const res = await fetch(`/api/reconcile/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, clientMatch, note }),
      });

      if (!res.ok) throw new Error("Failed to reconcile");

      setReconQueue((prev) =>
        prev.map((txn) =>
          txn.id === id
            ? { ...txn, status: "reconciled", tag, clientMatch, note }
            : txn
        )
      );
    } catch (err) {
      console.error("Reconciliation error:", err);
    }
  };

  return (
    <Layout currentPageName="Accountants">
      <div className="p-8 space-y-8">
        {/* Header + client switcher */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Accountant Dashboard
            </h1>
            <p className="text-slate-600 mt-1">
              Manage client access, reconcile transactions, and export statements
              across ProfitLens accounts.
            </p>
          </div>
          <select
            value={activeClientId}
            onChange={(e) => setActiveClientId(e.target.value)}
            className="border px-3 py-2 rounded-md"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.access})
              </option>
            ))}
          </select>
        </div>

        {/* Reconciliation Tasks */}
        <section className={card}>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Reconciliation Tasks
          </h2>
          {reconForClient.length === 0 ? (
            <p className="text-sm text-slate-500">No outstanding tasks.</p>
          ) : (
            <ul className="space-y-3">
              {reconForClient.map((txn) => (
                <li
                  key={txn.id}
                  className="flex justify-between items-center border-b pb-2"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      £{txn.amount} • {txn.date}
                    </p>
                    <p className="text-sm text-slate-500">{txn.description}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700">
                      {txn.status}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedTxn(txn);
                        setShowModal(true);
                      }}
                      className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Suggest Match
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Statement Vault */}
        <section className={card}>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Statement Vault
          </h2>
          {statementsForClient.length === 0 ? (
            <p className="text-sm text-slate-500">No statements found.</p>
          ) : (
            <ul className="space-y-3">
              {statementsForClient.map((s) => (
                <li
                  key={s.id}
                  className="flex justify-between items-center border-b pb-2"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {s.name} • {s.format}
                    </p>
                    <p className="text-sm text-slate-500">
                      From: {s.source} • {s.date}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      window.open(
                        `/api/storage/statements/${s.clientId}/${s.name}`,
                        "_blank"
                      )
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Export Queue */}
        <section className={card}>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Export Queue
          </h2>
          {exportsForClient.length === 0 ? (
            <p className="text-sm text-slate-500">No exports queued.</p>
          ) : (
            <ul className="space-y-3">
              {exportsForClient.map((e) => (
                <li
                  key={e.id}
                  className="flex justify-between items-center border-b pb-2"
                >
                  <div>
                    <p className="font-medium text-slate-800">{e.format}</p>
                    <p className="text-sm text-slate-500">{e.range}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700">
                    {e.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

                {/* Audit Trail */}
        <section className={card}>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Audit Trail
          </h2>
          {auditForClient.length === 0 ? (
            <p className="text-sm text-slate-500">No audit entries.</p>
          ) : (
            <ul className="space-y-2">
              {auditForClient.map((a) => (
                <li key={a.id} className="text-sm text-slate-700">
                  <span className="font-mono text-slate-500 mr-2">{a.date}</span>
                  <span className="font-medium">{a.user}</span> — {a.action}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Modal */}
      <ReconciliationModal
        isOpen={showModal}
        transaction={selectedTxn}
        onClose={() => setShowModal(false)}
        onReconcile={handleReconcile}
      />
    </Layout>
  );
}
