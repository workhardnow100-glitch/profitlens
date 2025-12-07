import { useState, useEffect, useRef } from "react";

export default function ExportBuilderModal({ isOpen, onClose, onCreate, clientId }) {
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [format, setFormat] = useState("Xero CSV");
  const [includeTags, setIncludeTags] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [error, setError] = useState("");
  const fromRef = useRef(null);

  useEffect(() => {
    if (isOpen && fromRef.current) {
      fromRef.current.focus();
      // reset form each time modal opens
      setRangeFrom("");
      setRangeTo("");
      setFormat("Xero CSV");
      setIncludeTags(true);
      setIncludeNotes(true);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    if (!rangeFrom || !rangeTo) {
      setError("Please select both dates.");
      return;
    }
    if (new Date(rangeFrom) > new Date(rangeTo)) {
      setError("Start date cannot be after end date.");
      return;
    }

    onCreate({
      clientId,
      rangeFrom,
      rangeTo,
      format,
      includeTags,
      includeNotes,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg space-y-4">
        <h2 id="export-modal-title" className="text-xl font-semibold text-slate-800">
          Create Export
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-600">From</label>
            <input
              ref={fromRef}
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">To</label>
            <input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-600">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="border px-3 py-2 rounded w-full"
          >
            <option>Xero CSV</option>
            <option>QuickBooks CSV</option>
            <option>FreeAgent CSV</option>
            <option>Generic CSV</option>
            <option>PDF Summary</option>
          </select>
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeTags}
              onChange={() => setIncludeTags(!includeTags)}
            />
            Include tags
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={() => setIncludeNotes(!includeNotes)}
            />
            Include notes
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Create Export
          </button>
        </div>
      </div>
    </div>
  );
}
