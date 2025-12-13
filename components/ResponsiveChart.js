// components/ResponsiveChart.js
import { ResponsiveContainer } from "recharts";

export default function ResponsiveChart({ children, height = 300 }) {
  return (
    <div className="w-full bg-white/70 rounded-lg border shadow-sm p-4 sm:p-6 mb-6">
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
