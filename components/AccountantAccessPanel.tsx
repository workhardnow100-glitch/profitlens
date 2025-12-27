import React, { useEffect, useState } from "react";

type MeResponse = {
  success: boolean;
  user: {
    role: string;
    clientId: string;
  };
};

export function AccountantAccessPanel() {
  const [accountantEmail, setAccountantEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hidePanel, setHidePanel] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  // ⭐ Hide panel for accountants, founders, admins (with cache-busting)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/accountant/me?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" }
        });

        if (!res.ok) {
          setCheckingRole(false);
          return;
        }

        const data: MeResponse = await res.json();
        const role = data.user.role;

        if (["accountant", "founder", "admin"].includes(role)) {
          setHidePanel(true);
        }
      } catch {
        // fail silently
      } finally {
        setCheckingRole(false);
      }
    };

    load();
  }, []);

  if (checkingRole) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
      </section>
    );
  }

  if (hidePanel) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/accountant/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountantEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send invitation");
      } else {
        setStatus(`Invitation sent to ${accountantEmail}`);
        setAccountantEmail("");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!accountantEmail) {
      setError("Enter the accountant email to revoke");
      return;
    }

    setStatus(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/accountant/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountantEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to revoke access");
      } else {
        setStatus(`Access revoked for ${accountantEmail}`);
        setAccountantEmail("");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Invite your accountant
      </h2>

      <p className="text-sm text-slate-600">
        Enter your accountant’s email. They’ll receive a secure link to view and file on your behalf.
      </p>

      <form onSubmit={handleInvite} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Accountant email
          </label>
          <input
            type="email"
            required
            value={accountantEmail}
            onChange={(e) => setAccountantEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="accountant@firm.com"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send invite"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleRevoke}
            className="inline-flex items-center rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Revoke access
          </button>
        </div>
      </form>

      {status && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded">
          {status}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">
          {error}
        </p>
      )}

      <p className="text-xs text-slate-400 pt-2 border-t mt-4">
        ProfitLens provides estimates only. Always verify figures before filing with HMRC.
      </p>
    </section>
  );
}
