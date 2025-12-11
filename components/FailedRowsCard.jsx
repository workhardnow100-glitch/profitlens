// components/FailedRowsCard.jsx
export default function FailedRowsCard({ failures = [] }) {
  // Always default to an empty array so .length is safe
  if (failures.length === 0) return null;

  return (
    <section className="mt-8">
      <h3 className="text-xl font-semibold mb-4">Failed Rows</h3>
      {failures.map((failure) => (
        <div
          key={failure.file}
          className="border border-red-400 rounded-md p-4 mb-4 bg-red-50 text-black"
        >
          <strong>{failure.file}</strong> — {failure.error}
          <ul className="mt-2 list-disc list-inside">
            {(failure.rowFailures || []).map((rowFail, idx) => (
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
