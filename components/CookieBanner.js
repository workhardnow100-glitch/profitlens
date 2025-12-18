import { useEffect, useState } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleConsent = (value) => {
    localStorage.setItem("cookie-consent", value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        backgroundColor: "#0f172a",
        color: "#fff",
        padding: "1rem",
        zIndex: 9999,
        boxShadow: "0 -2px 10px rgba(0,0,0,0.3)",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <p style={{ fontSize: "0.9rem", lineHeight: "1.4" }}>
          ProfitLens uses cookies to enhance your experience, improve performance,
          and analyze usage. You can accept all cookies or reject non‑essential
          ones. Read our{" "}
          <a
            href="/legal/cookies"
            style={{ color: "#38bdf8", textDecoration: "underline" }}
          >
            Cookie Policy
          </a>
          .
        </p>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => handleConsent("accepted")}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#22c55e",
              border: "none",
              borderRadius: "4px",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Accept All
          </button>

          <button
            onClick={() => handleConsent("rejected")}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#f87171",
              border: "none",
              borderRadius: "4px",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Reject Non‑Essential
          </button>
        </div>
      </div>
    </div>
  );
}
