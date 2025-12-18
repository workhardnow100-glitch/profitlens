// components/layout.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createPageUrl } from "../utils/createPageUrl";
import { useUser } from "../hooks/useUser";

import {
  BarChart3,
  Upload,
  Receipt,
  TrendingUp,
  FileText,
  Mail,
  Settings,
  Activity,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";

import Footer from "./Footer"; // ✅ ADD THIS

const navigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: BarChart3 },
  { title: "Clients", url: createPageUrl("Clients"), icon: Users },
  { title: "Upload Statements", url: createPageUrl("Upload"), icon: Upload },
  { title: "Transactions", url: createPageUrl("Transactions"), icon: Receipt },
  { title: "Reports", url: createPageUrl("Reports"), icon: FileText },
  { title: "Forecasts", url: createPageUrl("Forecasts"), icon: Activity },
  { title: "Email Integration", url: createPageUrl("EmailSetup"), icon: Mail },
  { title: "Bulk Processing", url: createPageUrl("BulkProcessing"), icon: Settings },
];

export default function Layout({ children }) {
  const router = useRouter();
  const { user } = useUser();

  return (
    <SidebarProvider>
      <LayoutInner router={router} user={user}>
        {children}
      </LayoutInner>
    </SidebarProvider>
  );
}

function LayoutInner({ router, user, children }) {
  const { open } = useSidebar();

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar */}
      <Sidebar
        className={`border-r border-slate-200/60 bg-white/80 backdrop-blur-sm z-40
          fixed inset-y-0 left-0 w-64 transform transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static`}
      >
        <SidebarHeader className="border-b border-slate-200/60 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">ProfitLens</h2>
              <p className="text-xs text-slate-500">Bank Statement Analyzer</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-3">
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => {
                  const isActive = router.asPath.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        aria-current={isActive ? "page" : undefined}
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-xl mb-1 ${
                          isActive
                            ? "bg-gradient-to-r from-blue-50 to-emerald-50 text-blue-700 shadow-sm"
                            : ""
                        }`}
                      >
                        <Link
                          href={item.url}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
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
        <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-6 py-4 md:hidden">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
            <h1 className="text-xl font-bold text-slate-900">ProfitLens</h1>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">{children}</div>

        {/* ✅ Footer added here */}
        <Footer />
      </main>
    </div>
  );
}
