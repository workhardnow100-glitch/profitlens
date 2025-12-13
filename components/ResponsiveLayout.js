// components/ResponsiveLayout.js
export default function ResponsiveLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="w-full bg-white shadow-md p-4">
        <h1 className="text-xl font-semibold">ProfitLens</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full bg-white shadow-inner p-4 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} ProfitLens
      </footer>
    </div>
  );
}
