import { useState } from "react";
import { useUser } from "../../hooks/useUser";

export default function FounderOverridePanel() {
  const { user } = useUser();
  const [targetEmail, setTargetEmail] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ✅ Match schema: founder/admin role
  if (user.role?.toLowerCase() !== "admin") return null;

  const handleOverride = async () => {
    if (!targetEmail || !targetEmail.includes("@")) {
      setStatus("Please enter a valid email.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/founder-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Override failed");
      setStatus(`✅ ${data.message || "Override complete"}`);
    } catch (err) {
      setStatus(`❌ ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-10 p-6 border rounded bg-white/70">
      <h3 className="text-lg font-semibold text-slate-800 mb-2">🛠️ Founder Override</h3>
      <p className="text-slate-600 mb-4">Manually unlock Pro features for any user.</p>

      <input
        type="email"
        placeholder="Target user email"
        value={targetEmail}
        onChange={(e) => setTargetEmail(e.target.value)}
        className="w-full border px-3 py-2 mb-4 rounded"
      />
      <button
        onClick={handleOverride}
        disabled={submitting}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {submitting ? "Processing..." : "Force Pro Access"}
      </button>

      {status && (
        <p
          className={`mt-4 text-sm ${
            status.startsWith("✅") ? "text-green-600" : "text-red-600"
          }`}
        >
          {status}
        </p>
      )}
    </div>
  );
}
