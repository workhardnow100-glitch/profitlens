// components/FailedRowsCard.jsx
export default function FailedRowsCard({ failures }) {
  if (!failures || failures.length === 0) return null;

  return (
    <section style={{ marginTop: "2rem" }}>
      <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
        Failed Rows
      </h3>
      {failures.map((failure) => (
        <div
          key={failure.file}
          style={{
            border: "1px solid #f87171",
            borderRadius: "6px",
            padding: "1rem",
            marginBottom: "1rem",
            backgroundColor: "#fff5f5",
          }}
        >
          <strong>{failure.file}</strong> — {failure.error}
          <ul style={{ marginTop: "0.5rem" }}>
            {failure.rowFailures?.map((rowFail, idx) => (
              <li key={idx}>
                Row {rowFail.row}: {rowFail.description} — {rowFail.error}
                {rowFail.date && ` (Date: ${rowFail.date})`}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
