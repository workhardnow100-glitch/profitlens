// pages/login.js
import Head from "next/head";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);

  async function onSubmit(e) {
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
      <main className="min-h-screen grid place-items-center bg-slate-900 text-white">
        <form
          onSubmit={onSubmit}
          className="bg-slate-800 p-6 rounded-lg w-80 shadow-lg"
        >
          <h1 className="text-xl font-bold mb-4">Sign in to ProfitLens</h1>

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
      </main>
    </>
  );
}
