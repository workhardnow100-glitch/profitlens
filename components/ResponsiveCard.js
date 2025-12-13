// components/ResponsiveCard.js
export default function ResponsiveCard({ title, children }) {
  return (
    <div className="w-full bg-white/70 rounded-lg border shadow-sm p-4 sm:p-6 mb-6">
      {title && <h2 className="text-lg font-semibold mb-2">{title}</h2>}
      {children}
    </div>
  );
}
