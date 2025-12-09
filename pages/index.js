import Head from "next/head";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";

export default function Home() {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [trialInfo, setTrialInfo] = useState({
    trialActive: true,
    trialEndsAt: null,
    status: "",
  });

  useEffect(() => {
    fetch("/api/trial-status")
      .then((res) => res.json())
      .then((data) => setTrialInfo(data))
      .catch(() =>
        setTrialInfo({ trialActive: false, trialEndsAt: null, status: "" })
      );
  }, []);

  const handleFounderLogin = async (e) => {
    e.preventDefault();
    if (pin === "010415") {
      await signIn("credentials", {
        email: "workhardnow100@gmail.com",
        redirect: true,
        callbackUrl: "/dashboard",
      });
    } else {
      setStatus("Invalid PIN");
    }
  };

  const handleClientLogin = async (e) => {
    e.preventDefault();
    const normalizedEmail = clientEmail.trim().toLowerCase();
    if (!normalizedEmail) return;
    await signIn("email", {
      email: normalizedEmail,
      redirect: true,
      callbackUrl: "/dashboard",
    });
  };

  const startTrial = async () => {
    await fetch("/api/start-trial", { method: "POST" });
    window.location.reload();
  };

  return (
    <>
      <Head>
        <title>ProfitLens</title>
        <meta
          name="description"
          content="Turn statements into strategy. Forecast profits. Grow smarter."
        />
      </Head>

      <main
        style={{
          position: "relative",
          fontFamily: "Inter, sans-serif",
          minHeight: "100vh",
          overflow: "hidden",
          backgroundColor: "#0f172a",
          color: "#fff",
          textAlign: "center",
        }}
      >
        {/* Background Image */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundImage: "url('/growth-bg.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 0,
            opacity: 0.2,
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            padding: "2rem",
            maxWidth: "960px",
            margin: "0 auto",
          }}
        >
          {/* Trial Banner */}
          {trialInfo.trialActive ? (
            <div
              style={{
                backgroundColor: "#22c55e",
                padding: "1rem",
                borderRadius: "8px",
                marginBottom: "1rem",
              }}
            >
              {trialInfo.status === "trialing" ? (
                <p>
                  ✅ Trial active — expires{" "}
                  {trialInfo.trialEndsAt
                    ? new Date(trialInfo.trialEndsAt).toLocaleString()
                    : "soon"}
                </p>
              ) : (
                <p>✅ Subscription active</p>
              )}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "#f87171",
                padding: "1rem",
                borderRadius: "8px",
                marginBottom: "1rem",
              }}
            >
              ❌ Trial expired — please upgrade to continue.{" "}
              <a
                href="https://buy.stripe.com/9B6aEYaXZ6Gr4U4d77cwg01"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#fff",
                  fontWeight: "bold",
                  textDecoration: "underline",
                }}
              >
                Upgrade Now
              </a>
            </div>
          )}

          {/* Trial Signup Button (for new/expired users) */}
          {!trialInfo.trialActive && (
            <button
              onClick={startTrial}
              style={{
                marginBottom: "2rem",
                padding: "0.6rem 1.2rem",
                backgroundColor: "#0ea5e9",
                color: "#fff",
                borderRadius: "4px",
                fontWeight: "bold",
                border: "none",
              }}
            >
              Start Free 24h Trial
            </button>
          )}

          {/* Logo + Tagline */}
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "2rem",
            }}
          >
            <img
              src="/logo.png"
              alt="ProfitLens Logo"
              style={{ height: "60px", marginBottom: "1rem" }}
            />
            <h1 style={{ fontSize: "2rem", fontWeight: "600", margin: 0 }}>
              ProfitLens
            </h1>
            <p
              style={{
                fontSize: "1rem",
                marginTop: "0.5rem",
                maxWidth: "600px",
                textAlign: "center",
              }}
            >
              Turn statements into strategy. Forecast profits. Grow smarter.
            </p>
          </section>

          {/* Features */}
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
              Features
            </h2>
            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "flex-start",
                marginTop: "1rem",
              }}
            >
              <div style={{ minWidth: "220px", flex: "1", textAlign: "left" }}>
                ✅ Real-time analytics
              </div>
              <div style={{ minWidth: "220px", flex: "1", textAlign: "left" }}>
                ✅ Automated trade signals
              </div>
              <div style={{ minWidth: "220px", flex: "1", textAlign: "left" }}>
                ✅ Cross-border compliance tools
              </div>
              <div style={{ minWidth: "220px", flex: "1", textAlign: "left" }}>
                ✅ Banking statement analytics
              </div>
              <div style={{ minWidth: "220px", flex: "1", textAlign: "left" }}>
                ✅ Profit & Loss Account
              </div>
              <div style={{ minWidth: "220px", flex: "1", textAlign: "left" }}>
                ✅ Forcasted Projections
              </div>
              <div style={{ minWidth: "220px", flex: "1", textAlign: "left" }}>
                ✅ PDF & CSV Downloading
              </div>
              <div style={{ minWidth: "220px", flex: "1", textAlign: "left" }}>
                ✅ Open Banking
              </div>
              <div style={{ minWidth: "220px", flex: "1", textAlign: "left" }}>
                ✅ Visualize Profits Self Input
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Plans</h2>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "2rem",
                flexWrap: "wrap",
              }}
            >
              {/* Basic Plan */}
              <div
                style={{
                  backgroundColor: "#1e3a8a",
                  padding: "1rem",
                  borderRadius: "8px",
                  minWidth: "240px",
                  maxWidth: "280px",
                  color: "#fff",
                }}
              >
                <h3 style={{ marginBottom: "0.5rem" }}>Basic Plan</h3>
                <p style={{ marginBottom: "1rem" }}>£29.00/month</p>
                <a
                  href="https://buy.stripe.com/9B6aEYaXZ6Gr4U4d77cwg01"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "0.6rem 1.2rem",
                    backgroundColor: "#0ea5e9",
                    color: "#fff",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    textDecoration: "none",
                  }}
                >
                  Subscribe Basic
                </a>
              </div>

              {/* Pro Plan */}
              <div
                style={{
                  backgroundColor: "#0ea5e9",
                  padding: "1rem",
                  borderRadius: "8px",
                  minWidth: "240px",
                  maxWidth: "280px",
                  color: "#fff",
                }}
              >
                <h3 style={{ marginBottom: "0.5rem" }}>Pro Plan</h3>
                <p style={{ marginBottom: "1rem" }}>£149.00/year</p>
                <a
                  href="https://buy.stripe.com/3cI28sd671m786gaYZcwg02"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "0.6rem 1.2rem",
                    backgroundColor: "#1e3a8a",
                    color: "#fff",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    textDecoration: "none",
                  }}
                >
                  Subscribe Pro
                </a>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>FAQ</h2>
            <p>
              <strong>Can I cancel anytime?</strong> Yes, your subscription is
              flexible.
            </p>
            <p>
              <strong>Is Stripe secure?</strong> 100%. We never store your card
              details.
            </p>
          </section>

          {/* Contact */}
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
              Contact
            </h2>
            <p>
              Questions? Reach us at{" "}
              <a
                href="mailto:profitlensappp@gmail.com"
                style={{ color: "#38bdf8", textDecoration: "underline" }}
              >
                profitlensappp@gmail.com
              </a>
            </p>
          </section>

          {/* Founder + Client side-by-side */}
          <div
            style={{
              display: "flex",
              gap: "2rem",
              marginTop: "3rem",
              flexWrap: "wrap",
            }}
          >
            {/* Founder PIN Login — always available */}
            <section style={{ flex: "1", minWidth: "280px" }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
                Founder Access
              </h2>

              <form
                onSubmit={handleFounderLogin}
                style={{ display: "flex", gap: "0.5rem" }}
              >
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter Founder PIN"
                  style={{
                    padding: "0.5rem",
                    borderRadius: "4px",
                    border: "none",
                    fontSize: "1rem",
                    flex: 1,
                  }}
                />

                <button
                  type="submit"
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#38bdf8",
                    color: "#fff",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    border: "none",
                    fontSize: "1rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  Unlock
                </button>
              </form>

              {status && (
                <p style={{ marginTop: "1rem", color: "#f87171" }}>{status}</p>
              )}
            </section>

            {/* Client Magic Link Login — gated by trial */}
            <section style={{ flex: "1", minWidth: "280px" }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
                Client Login
              </h2>

              {trialInfo.trialActive ? (
                <form
                  onSubmit={handleClientLogin}
                  style={{ display: "flex", gap: "0.5rem" }}
                >
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="Enter your email"
                    style={{
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "none",
                      fontSize: "1rem",
                      flex: 1,
                    }}
                  />

                  <button
                    type="submit"
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#38bdf8",
                      color: "#fff",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      border: "none",
                      fontSize: "1rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Login
                  </button>
                </form>
              ) : (
                <div style={{ marginTop: "1rem" }}>
                  <p style={{ color: "#f87171", marginBottom: "0.75rem" }}>
                    Trial expired — upgrade or start a new trial to log in.
                  </p>
                  <button
                    onClick={startTrial}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#0ea5e9",
                      color: "#fff",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      border: "none",
                      fontSize: "1rem",
                    }}
                  >
                    Start Free 24h Trial
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Video Section */}
          <section style={{ marginTop: "3rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
              Watch ProfitLens in Action
            </h2>
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              <video
                controls
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                <source src="/demo.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
