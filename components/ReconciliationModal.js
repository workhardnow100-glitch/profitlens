import React, { useState } from "react";

export default function ReconciliationModal({
  isOpen,
  transaction,
  onClose,
  onReconcile,
}) {
  if (!isOpen || !transaction) return null;

  const [tag, setTag] = useState("");
  const [clientMatch, setClientMatch] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    onReconcile({
      id: transaction.id,
      tag,
      clientMatch,
      note,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">
          Reconcile Transaction
        </h2>

        <div className="mb-4">
          <p className="text-sm text-slate-600">
            <strong>Amount:</strong> £{transaction.amount}
          </p>
          <p className="text-sm text-slate-600">
            <strong>Date:</strong> {transaction.date}
          </p>
          <p className="text-sm text-slate-600">
            <strong>Description:</strong> {transaction.description}
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />

          <input
            type="text"
            placeholder="Client Match"
            value={clientMatch}
            onChange={(e) => setClientMatch(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />

          <textarea
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Reconcile
          </button>
        </div>
      </div>
    </div>
  );
}
