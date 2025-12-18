export default function Footer() {
  return (
    <footer
      style={{
        padding: "30px 20px",
        marginTop: "60px",
        borderTop: "1px solid #e5e7eb",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
          <a href="/legal/terms">Terms</a>
          <a href="/legal/privacy">Privacy</a>
          <a href="/legal/cookies">Cookies</a>
          <a href="/legal/refund">Refund Policy</a>
          <a href="/legal/aup">Acceptable Use</a>
          <a href="/legal/sla">SLA</a>
          <a href="/legal/security">Security</a>
          <a href="/legal/disclaimer">Disclaimer</a>
          <a href="/legal">Legal Hub</a>
        </div>

        <div style={{ fontSize: "14px", color: "#6b7280" }}>
          © {new Date().getFullYear()} ProfitLens Technologies Ltd — Trading as
          ProfitLens UK
        </div>
      </div>
    </footer>
  );
}
