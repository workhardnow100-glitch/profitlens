// pages/upgrade.js
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

export default function Upgrade() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 🔑 If founder or already subscribed, redirect away
  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      const isAdmin = session.user.role === "admin";
      const isSubscribed = ["basic", "pro"].includes(session.user.subscriptionStatus);

      if (isAdmin || isSubscribed) {
        router.replace("/dashboard");
      }
    }
  }, [session, status, router]);

  return (
    <div style={{ padding: "2rem", textAlign: "center", fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>
        🚀 Upgrade Your Access
      </h1>
      <p style={{ fontSize: "1rem", marginBottom: "2rem" }}>
        To unlock your ProfitLens dashboard, choose a plan below. Your cockpit awaits.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "2rem",
          flexWrap: "wrap",
        }}
      >
        <a
          href="https://buy.stripe.com/9B6aEYaXZ6Gr4U4d77cwg01"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "0.8rem 1.6rem",
            backgroundColor: "#0ea5e9",
            color: "#fff",
            borderRadius: "6px",
            fontWeight: "bold",
            textDecoration: "none",
            minWidth: "200px",
          }}
        >
          Subscribe Basic (£29/month)
        </a>

        <a
          href="https://buy.stripe.com/3cI28sd671m786gaYZcwg02"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "0.8rem 1.6rem",
            backgroundColor: "#1e3a8a",
            color: "#fff",
            borderRadius: "6px",
            fontWeight: "bold",
            textDecoration: "none",
            minWidth: "200px",
          }}
        >
          Subscribe Pro (£149/year)
        </a>
      </div>

      <p style={{ marginTop: "2rem", fontSize: "0.9rem", color: "#64748b" }}>
        Already subscribed? Check your email for a login link or contact support.
      </p>
    </div>
  );
}

