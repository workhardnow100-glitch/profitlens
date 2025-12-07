import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from "recharts";

export function RevenuePie({ data = [], height = 300, colors }) {
  const COLORS = colors ?? ["#4ade80", "#22c55e", "#16a34a", "#15803d"];

  if (!data.length) {
    return <p className="text-sm text-slate-500">No revenue data available.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart aria-label="Revenue distribution">
        <Pie
          data={data}
          dataKey="value"
          nameKey="category"
          cx="50%"
          cy="50%"
          outerRadius="80%" // ✅ responsive radius
          label
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `£${value}`} /> {/* ✅ consistent currency */}
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ExpenseBar({ data = [], height = 300, colors }) {
  const barColor = colors?.[0] ?? "#ef4444";

  if (!data.length) {
    return <p className="text-sm text-slate-500">No expense data available.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} aria-label="Expense breakdown by category">
        <XAxis dataKey="category" />
        <YAxis />
        <Tooltip formatter={(value) => `£${value}`} />
        <Bar dataKey="value" fill={barColor} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProfitTrend({ data = [], height = 300, colors }) {
  const lineColor = colors?.[0] ?? "#0ea5e9";

  if (!data.length) {
    return <p className="text-sm text-slate-500">No profit trend available.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} aria-label="Profit trend over time">
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => `£${value}`} />
        <Legend />
        <Line type="monotone" dataKey="profit" stroke={lineColor} name="Net Profit" />
      </LineChart>
    </ResponsiveContainer>
  );
}
