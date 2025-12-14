// components/ui/sidebar.js
import React, { createContext, useContext, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart, Users } from "lucide-react";

// Context for sidebar state
const SidebarContext = createContext();
export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};

// Sidebar that slides in/out on mobile
export const Sidebar = ({ children, className }) => {
  const { open } = useSidebar();
  return (
    <aside
      className={`${className} fixed inset-y-0 left-0 w-64 transform bg-white transition-transform duration-200 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static`}
    >
      {children}
    </aside>
  );
};

// Trigger toggles sidebar open/close
export const SidebarTrigger = ({ children, className }) => {
  const { setOpen } = useSidebar();
  return (
    <button
      onClick={() => setOpen((prev) => !prev)}
      className={className}
    >
      {children || "☰"}
    </button>
  );
};

// Structural wrappers
export const SidebarHeader = ({ children, className }) => (
  <div className={className}>{children}</div>
);
export const SidebarContent = ({ children, className }) => (
  <div className={className}>{children}</div>
);
export const SidebarGroup = ({ children, className }) => (
  <div className={className}>{children}</div>
);
export const SidebarGroupLabel = ({ children, className }) => (
  <div className={className}>{children}</div>
);
export const SidebarGroupContent = ({ children, className }) => (
  <div className={className}>{children}</div>
);
export const SidebarFooter = ({ children, className }) => (
  <div className={className}>{children}</div>
);
export const SidebarMenuItem = ({ children }) => <li>{children}</li>;
export const SidebarMenuButton = ({ children, className }) => (
  <div className={className}>{children}</div>
);

// SidebarMenu with navigation items
export function SidebarMenu() {
  const router = useRouter();
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
    { title: "Accountants", url: "/accountants", icon: Users },
    { title: "MTD Dashboard", url: "/mtd-dashboard", icon: BarChart },
  ];

  return (
    <ul className="space-y-1">
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
    </ul>
  );
}
