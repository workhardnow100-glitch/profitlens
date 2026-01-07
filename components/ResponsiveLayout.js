import React, { useState, useEffect } from "react";
import { useUser } from "../hooks/useUser";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarFooter,
  SidebarTrigger,
} from "./ui/sidebar";
import { TrendingUp } from "lucide-react";

// ✅ Global Accountant Banner Component
function ActingAsBanner() {
  const [actingAs, setActingAs] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/accountant/me");
        if (!res.ok) return;

        const data = await res.json();
        setRole(data.user.role);
        setActingAs(data.user.actingAsClientId);
      } catch {
        // ignore errors silently
      }
    };
    load();
  }, []);

  // ✅ Only show for accountants who are acting as a client
  if (role !== "accountant" || !actingAs) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 py-2 px-6 text-sm text-amber-800">
      <span className="font-semibold">Acting as client:</span>{" "}
      <span className="font-mono">{actingAs}</span>
    </div>
  );
}

export default function ResponsiveLayout({ children }) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Sidebar */}
        <Sidebar
          className={`border-r border-slate-200/60 bg-white/80 backdrop-blur-sm
            ${isOpen ? "block" : "hidden"} md:block`}
        >
          <SidebarHeader className="border-b border-slate-200/60 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="w-full flex flex-col items-center text-center px-4 py-2">
  <h2 className="font-bold text-slate-900 text-lg tracking-tight">ProfitLens</h2>

  <p className="text-[10px] text-slate-500 whitespace-normal leading-snug mt-1 max-w-[150px]">
    Bank Statement Analyzer, Acting Accountant Software & Tax Submissions
  </p>
</div>

            </div>
          </SidebarHeader>

          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200/60 p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-slate-200 to-slate-300 rounded-full flex items-center justify-center">
                <span className="text-slate-700 font-medium text-sm">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">
                  {user?.email || "User"}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {user?.role || "Analyze your profits"}
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header with sidebar trigger */}
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger
                onClick={() => setIsOpen(!isOpen)}
                className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200"
              />
              <h1 className="text-xl font-bold text-slate-900">ProfitLens</h1>
            </div>
          </header>

          {/* ✅ Global Accountant Banner */}
          <ActingAsBanner />

          {/* Page content */}
          <div className="flex-1 overflow-auto p-6">{children}</div>

          {/* Footer */}
          <footer className="w-full bg-white/80 backdrop-blur-sm border-t border-slate-200/60 p-4 text-center text-sm text-slate-500">
            © {new Date().getFullYear()} ProfitLens
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}
