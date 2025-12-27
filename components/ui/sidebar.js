import React, { useState, useEffect } from "react";
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

import { useUser } from "../../hooks/useUser"; // ⭐ FIXED — this was missing

// Structural wrappers
export const SidebarProvider = ({ children }) => <>{children}</>;
export const Sidebar = ({ children, className }) => (
  <aside className={className}>{children}</aside>
);
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
export const SidebarTrigger = ({ children, className, ...props }) => (
  <button {...props} className={className}>
    {children || "☰"}
  </button>
);
export const SidebarMenuItem = ({ children }) => <li>{children}</li>;
export const SidebarMenuButton = ({ children, className }) => (
  <div className={className}>{children}</div>
);

// ⭐⭐⭐ FIXED CLIENT SWITCHER — ONLY CHANGE IS THE ENDPOINT ⭐⭐⭐
function ClientSwitcher() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    async function load() {
      // ⭐ FIXED: this was the broken endpoint
      const res = await fetch("/api/accountant/clients");
      const data = await res.json();

      if (res.ok && data.clients) {
        setClients(data.clients);
        setCurrent(data.currentClient || null);
      }
    }
    load();
  }, []);

  if (!clients || clients.length <= 1) return null;

  const handleChange = async (e) => {
    const newClientId = e.target.value;
    setCurrent(newClientId);

    await fetch("/api/accountant/switch-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: newClientId }),
    });

    router.reload();
  };

  return (
    <div className="p-3 border-b bg-white">
      <label className="block text-xs font-semibold text-slate-500 mb-1">
        Acting as:
      </label>
      <select
        value={current || ""}
        onChange={handleChange}
        className="w-full border p-2 rounded text-sm"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Sidebar Menu
export function SidebarMenu() {
  const router = useRouter();
  const { user } = useUser(); // ⭐ Now correctly imported

  const [taxOpen, setTaxOpen] = useState(true);
  const [formsOpen, setFormsOpen] = useState(true);

  // ⭐ Accountant + Founder + Admin see accountant dashboard
  const accountantNav = [
    {
      title: "Accountant Dashboard",
      url: "/accountant/dashboard",
      icon: Users,
      roles: ["accountant", "founder", "admin"],
    },
  ];

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

  const formsItems = [
    { title: "Forms Hub", url: "/forms", icon: FileText },
    { title: "PDF Library & Working Papers", url: "/forms/pdfs", icon: History },
  ];

  return (
    <ul className="space-y-1">

      {/* ⭐ Accountant Client Switcher */}
      {(user?.role === "accountant" ||
        user?.role === "founder" ||
        user?.role === "admin") && <ClientSwitcher />}

      {/* ⭐ Accountant Dashboard link */}
 {/* ⭐ Accountant Dashboard + Client Dropdown */}
{(user?.role === "accountant" ||
  user?.role === "founder" ||
  user?.role === "admin") && (
  <SidebarMenuItem>
    <div className="px-4 py-2 text-slate-700 font-semibold flex items-center gap-2">
      <Users size={16} />
      <span>Accountant Dashboard</span>
    </div>

    {/* Dropdown */}
    <div className="ml-6 mt-1 space-y-1">
      {clients?.map((c) => (
        <button
          key={c.id}
          onClick={async () => {
            await fetch("/api/accountant/switch-clients", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientId: c.id }),
            });
            router.push("/accountant/dashboard");
          }}
          className={`block w-full text-left px-3 py-1 rounded text-sm ${
            me?.actingAsClientId === c.id
              ? "bg-blue-50 text-blue-700"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  </SidebarMenuItem>
)}

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

      {/* Taxes group */}
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

      {/* Forms group */}
      <SidebarGroup className="mt-4">
        <button
          onClick={() => setFormsOpen(!formsOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-slate-500 uppercase text-xs font-semibold hover:bg-slate-100 rounded"
        >
          <span>Forms</span>
          <ChevronDown
            size={16}
            className={`transition-transform ${formsOpen ? "rotate-180" : ""}`}
          />
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            formsOpen ? "max-h-[1000px]" : "max-h-0"
          }`}
        >
          <SidebarGroupContent>
            {formsItems.map(({ title, url, icon: Icon }) => (
              <SidebarMenuItem key={title}>
                <Link
                  href={url}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                    router.pathname.startsWith(url)
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
