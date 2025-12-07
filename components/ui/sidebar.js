import Link from "next/link";
import { useRouter } from "next/router";
import {
  Users,
  BarChart,
  ChevronRight,
  LogOut,
} from "lucide-react";

export function SidebarProvider({ children }) {
  return <div className="flex">{children}</div>;
}

export function Sidebar({ children, className = "" }) {
  return (
    <aside className={`w-64 h-screen bg-white ${className}`}>
      {children}
    </aside>
  );
}

export function SidebarHeader({ children, className = "" }) {
  return <div className={`border-b p-4 ${className}`}>{children}</div>;
}

export function SidebarContent({ children, className = "" }) {
  return <div className={`flex-1 overflow-y-auto ${className}`}>{children}</div>;
}

export function SidebarGroup({ children }) {
  return <div className="mb-6">{children}</div>;
}

export function SidebarGroupLabel({ children, className = "" }) {
  return (
    <div className={`text-xs font-semibold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </div>
  );
}

export function SidebarGroupContent({ children }) {
  return <div className="mt-2">{children}</div>;
}

export function SidebarMenu({ children }) {
  const router = useRouter();

  const navigationItems = [
    { title: "Dashboard", url: "/dashboard", icon: BarChart },
    { title: "Profile", url: "/profile", icon: Users },   // ✅ new profile link
    { title: "Clients", url: "/clients", icon: Users },
    { title: "Upload", url: "/upload", icon: Users },
    { title: "Transactions", url: "/transactions", icon: BarChart },
    { title: "Reports", url: "/reports", icon: BarChart },
    { title: "Forecasts", url: "/forecasts", icon: BarChart },
    { title: "Email Setup", url: "/emailsetup", icon: Users },
    { title: "Bulk Processing", url: "/bulkprocessing", icon: BarChart },
    { title: "Accountants", url: "/accountants", icon: Users },
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

export function SidebarMenuItem({ children }) {
  return <li>{children}</li>;
}

export function SidebarMenuButton({ children, className = "", asChild = false }) {
  return <div className={className}>{children}</div>;
}

export function SidebarFooter({ children, className = "" }) {
  return <div className={`mt-auto ${className}`}>{children}</div>;
}

export function SidebarTrigger({ onClick, className = "", children }) {
  return (
    <button onClick={onClick} className={`p-2 ${className}`}>
      {children || <ChevronRight size={20} />}
    </button>
  );
}
