// components/ui/sidebar.js
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  BarChart,
  Users,
  FileText,
  DollarSign,
  History,
  ChevronDown,
} from "lucide-react";

// ✅ Structural wrappers
export const SidebarProvider = ({ children }) => <>{children}</>;
export const Sidebar = ({ children, className }) => <aside className={className}>{children}</aside>;
export const SidebarHeader = ({ children, className }) => <div className={className}>{children}</div>;
export const SidebarContent = ({ children, className }) => <div className={className}>{children}</div>;
export const SidebarGroup = ({ children, className }) => <div className={className}>{children}</div>;
export const SidebarGroupLabel = ({ children, className }) => <div className={className}>{children}</div>;
export const SidebarGroupContent = ({ children, className }) => <div className={className}>{children}</div>;
export const SidebarFooter = ({ children, className }) => <div className={className}>{children}</div>;
export const SidebarTrigger = ({ children, className, ...props }) => (
  <button {...props} className={className}>
    {children || "☰"}
  </button>
);
export const SidebarMenuItem = ({ children }) => <li>{children}</li>;
export const SidebarMenuButton = ({ children, className }) => <div className={className}>{children}</div>;

// ✅ SidebarMenu with collapsible tax group
export function SidebarMenu() {
  const router = useRouter();

  // ✅ Collapsible state
  const [taxOpen, setTaxOpen] = useState(true);

  const navigationItems = [
    { title: "Dashboard", url: "/dashboard", icon: BarChart },
    { title: "Profile", url: "/profile", icon: Users },
    { title: "Clients", url: "/clients", icon: Users },
    { title: "Upload", url: "/upload", icon: Users },
    { title: "Transactions", url: "/transactions", icon: BarChart },
    { title: "Reports", url: "/reports", icon: BarChart },
    { title: "Forecasts", url: "/forecasts", icon: BarChart },
    { title: "Email Setup", url: "/emailsetup", icon: Users },
    { title: "Bulk Processing", url: "/bulkprocessing", icon: BarChart },

  ];

  const taxItems = [
    { title: "Tax Hub", url: "/tax-hub", icon: DollarSign },

    { title: "VAT", url: "/vat", icon: FileText },
    { title: "VAT History", url: "/vat/history", icon: History },

    { title: "CIS", url: "/cis", icon: FileText },
    { title: "CIS History", url: "/cis/history", icon: History },

    { title: "Corporation Tax", url: "/corp", icon: FileText },
    { title: "CT History", url: "/corp/history", icon: History },

    { title: "Self Assessment", url: "/sa", icon: FileText },
    { title: "SA History", url: "/sa/history", icon: History },
  ];

  return (
    <ul className="space-y-1">
      {/* Default navigation */}
      {navigationItems.map(({ title, url, icon: Icon }) => (
        <SidebarMenuItem key={title}>
          <Link
            href={url}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              router.pathname === url
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon size={16} />
            <span>{title}</span>
          </Link>
        </SidebarMenuItem>
      ))}

      {/* ✅ Collapsible Taxes group */}
      <SidebarGroup className="mt-4">
        <button
          onClick={() => setTaxOpen(!taxOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-slate-500 uppercase text-xs font-semibold hover:bg-slate-100 rounded"
        >
          <span>Taxes</span>
          <ChevronDown
            size={16}
            className={`transition-transform ${taxOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* ✅ Smooth collapse */}
        <div
          className={`overflow-hidden transition-all duration-300 ${
            taxOpen ? "max-h-[1000px]" : "max-h-0"
          }`}
        >
          <SidebarGroupContent>
            {taxItems.map(({ title, url, icon: Icon }) => (
              <SidebarMenuItem key={title}>
                <Link
                  href={url}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                    router.pathname === url
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={16} />
                  <span>{title}</span>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarGroupContent>
        </div>
      </SidebarGroup>
    </ul>
  );
}
