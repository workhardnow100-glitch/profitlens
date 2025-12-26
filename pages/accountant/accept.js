import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function AcceptAccountantInvite() {
  const router = useRouter();
  const { token } = router.query;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Verifying your invite…");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;

    const acceptInvite = async () => {
      try {
        const res = await fetch("/api/accountant/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Invite could not be accepted");
          setStatus(null);
          setLoading(false);
          return;
        }

        // ⭐ NEW: Redirect accountant to NextAuth login URL
        if (data.loginUrl) {
          setStatus("Invitation accepted. Redirecting to secure login…");
          window.location.href = data.loginUrl;
          return;
        }

        // Fallback (should never happen)
        setError("Invitation accepted, but login link missing.");
        setStatus(null);
      } catch (err) {
        setError("Network error");
        setStatus(null);
      } finally {
        setLoading(false);
      }
    };

    acceptInvite();
  }, [token, router]);

  return (
    <main className="max-w-md mx-auto mt-20 p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
      <h1 className="text-xl font-bold text-slate-900 mb-4">
        Accept Accountant Invite
      </h1>

      {loading && (
        <p className="text-sm text-slate-600">Checking invite token…</p>
      )}

      {status && (
        <p className="text-sm text-emerald-700 font-medium">{status}</p>
      )}

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      <p className="text-xs text-slate-400 mt-6 border-t pt-3">
        ProfitLens provides estimates only. Always verify figures before filing
        with HMRC. Nothing displayed here constitutes tax, accounting, or legal
        advice.
      </p>
    </main>
  );
}
