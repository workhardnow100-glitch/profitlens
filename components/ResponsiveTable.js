// components/ResponsiveTable.js
export default function ResponsiveTable({ headers, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border rounded bg-white/70">
        {headers && (
          <thead>
            <tr className="bg-slate-100 text-left">
              {headers.map((h) => (
                <th key={h} className="p-2 border">{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
