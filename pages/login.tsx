// pages/login.tsx
import Head from "next/head";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null); // ✅ FIXED

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const res = await signIn("email", {
        redirect: false,
        email: normalizedEmail,
        callbackUrl: "/dashboard",
      });

      if (res?.error) {
        setError(res.error);
      } else {
        // ✅ Session enrichment will run in NextAuth callbacks
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setError("Unexpected error during sign-in");
      console.error("Login error:", err);
    }
  }

  return (
    <>
      <Head>
        <title>Login – ProfitLens</title>
      </Head>
      <main className="min-h-screen bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto py-12 px-6 grid md:grid-cols-2 gap-12 items-start">
          {/* Login Form */}
          <form
            onSubmit={onSubmit}
            className="bg-slate-800 p-6 rounded-lg shadow-lg"
          >
            <h1 className="text-2xl font-bold mb-4">Sign in to ProfitLens</h1>

            <label className="block mb-2 text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <button
              type="submit"
              className="mt-4 w-full py-2 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold"
            >
              Send Magic Link
            </button>

            {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
          </form>

          {/* Information / Marketing Section */}
          <div>
            <h2 className="text-3xl font-bold mb-6">Why ProfitLens?</h2>
            <p className="mb-4 text-slate-300">
              ProfitLens is your all-in-one SaaS platform for financial analysis.
              We help finance teams, founders, and analysts transform raw data
              into audit-ready insights in seconds.
            </p>

            <div className="grid gap-6">
              <div>
                <h3 className="text-xl font-semibold">📊 Financial Analysis at Scale</h3>
                <p className="text-slate-400">
                  Automated dashboards, instant reporting, and deep insights
                  without manual spreadsheets.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold">🔒 Compliance Built-In</h3>
                <p className="text-slate-400">
                  Every action is logged. With audit trails, RLS policies, and
                  strict data integrity, you can trust your numbers.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold">⚡ Instant Onboarding</h3>
                <p className="text-slate-400">
                  Start a trial in minutes. Magic link login means no passwords,
                  no friction — just secure access.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mt-8 mb-4">How It Works</h2>
            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>Enter your email above.</li>
              <li>Click the magic link we send you.</li>
              <li>Land in your dashboard with full trial access.</li>
            </ol>

            <h2 className="text-2xl font-bold mt-8 mb-4">Trusted by Teams</h2>
            <blockquote className="italic text-slate-400 border-l-4 border-sky-500 pl-4">
              “ProfitLens saved us hours of manual reconciliation and gave us
              confidence in our compliance reporting.”
            </blockquote>

            <p className="mt-6 text-slate-300">
              Even if your link expired, you can request a new one above and
              start exploring ProfitLens today.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
