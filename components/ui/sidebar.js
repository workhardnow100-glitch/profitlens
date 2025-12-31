import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import {
  BarChart,
  Users,
  FileText,
  PoundSterling,
  History,
  ChevronDown,
} from "lucide-react";


import { useUser } from "../../hooks/useUser";

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

// ⭐ ONE SINGLE, RELIABLE CLIENT SWITCH FUNCTION
async function switchClientGlobal(clientId) {
  try {
    await fetch("/api/accountant/switch-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });

    await fetch("/api/auth/session?update=1");

    window.location.reload();
  } catch (err) {
    console.error("Client switch failed:", err);
    alert("Failed to switch client");
  }
}

// ⭐ FIXED Client Switcher (top dropdown)
function ClientSwitcher() {
  const { user } = useUser();
  const [clients, setClients] = useState([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/accountant/clients");
      const data = await res.json();

      if (res.ok && data.clients) {
        setClients(data.clients);
      }
    }
    load();
  }, []);

  const current = user?.actingAsClientId || "";

  if (!clients || clients.length <= 1) return null;

  const handleChange = async (e) => {
    const newClientId = e.target.value;
    await switchClientGlobal(newClientId);
  };

  return (
    <div className="p-3 border-b bg-white">
      <label className="block text-xs font-semibold text-slate-500 mb-1">
        Acting For Client:
      </label>
      <select
        value={current}
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

// ⭐ Sidebar Menu
export function SidebarMenu() {
  const router = useRouter();
  const { user } = useUser();

  const [taxOpen, setTaxOpen] = useState(true);
  const [formsOpen, setFormsOpen] = useState(true);
  const [invoicesOpen, setInvoicesOpen] = useState(true);
  const [recurringOpen, setRecurringOpen] = useState(true);
  const [paymentsOpen, setPaymentsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const [clients, setClients] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/accountant/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setMe(meData.user);
      }

      const res = await fetch("/api/accountant/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    }
    load();
  }, []);

  const taxItems = [
    { title: "Tax Hub", url: "/tax-hub", icon: PoundSterling },
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

      {/* ⭐ Accountant Dashboard */}
      {(user?.role === "accountant" ||
        user?.role === "founder" ||
        user?.role === "admin") && (
        <SidebarMenuItem>
          <Link
            href="/accountant/dashboard"
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              router.pathname === "/accountant/dashboard"
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Users size={16} />
            <span>Accountant Dashboard</span>
          </Link>

          {/* ⭐ Client List */}
          <div className="ml-6 mt-1 space-y-1">
            {clients?.map((c) => (
              <button
                key={c.id}
                onClick={() => switchClientGlobal(c.id)}
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

      {/* ⭐ MAIN NAVIGATION */}
      <SidebarMenuItem>
        <Link
          href="/dashboard"
          className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
            router.pathname === "/dashboard"
              ? "bg-blue-50 text-blue-700 font-semibold"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <BarChart size={16} />
          <span>Dashboard</span>
        </Link>
      </SidebarMenuItem>

      {/* ⭐ TAXES */}
      <SidebarGroup className="mt-4">
        <button
          onClick={() => setTaxOpen(!taxOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-slate-500 uppercase text-xs font-semibold hover:bg-slate-100 rounded"
        >
          <span>Taxes</span>
          <ChevronDown size={16} className={`transition-transform ${taxOpen ? "rotate-180" : ""}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ${taxOpen ? "max-h-[1000px]" : "max-h-0"}`}>
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

      {/* ⭐ FORMS */}
      <SidebarGroup className="mt-4">
        <button
          onClick={() => setFormsOpen(!formsOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-slate-500 uppercase text-xs font-semibold hover:bg-slate-100 rounded"
        >
          <span>Forms</span>
          <ChevronDown size={16} className={`transition-transform ${formsOpen ? "rotate-180" : ""}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ${formsOpen ? "max-h-[1000px]" : "max-h-0"}`}>
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

      {/* ⭐ INVOICING COCKPIT */}
      <SidebarGroup className="mt-4">
        <button
          onClick={() => setInvoicesOpen(!invoicesOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-slate-500 uppercase text-xs font-semibold hover:bg-slate-100 rounded"
        >
          <span>Invoicing</span>
          <ChevronDown size={16} className={`transition-transform ${invoicesOpen ? "rotate-180" : ""}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ${invoicesOpen ? "max-h-[1000px]" : "max-h-0"}`}>
          <SidebarGroupContent>

            {/* All Invoices */}
            <SidebarMenuItem>
              <Link
                href="/invoices"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname.startsWith("/invoices") &&
                  !router.pathname.includes("/settings")
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <FileText size={16} />
                <span>Invoices</span>
              </Link>
            </SidebarMenuItem>

            {/* New Invoice */}
            <SidebarMenuItem>
              <Link
                href="/invoices/new"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname === "/invoices/new"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <FileText size={16} />
                <span>New Invoice</span>
              </Link>
            </SidebarMenuItem>

            {/* External Clients */}
            <SidebarMenuItem>
              <Link
                href="/external-clients"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname.startsWith("/external-clients")
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Users size={16} />
                <span>Clients</span>
              </Link>
            </SidebarMenuItem>

            {/* Invoice Settings */}
            <SidebarMenuItem>
              <Link
                href="/settings/invoices"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname === "/settings/invoices"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <FileText size={16} />
                <span>Invoice Settings</span>
              </Link>
            </SidebarMenuItem>

          </SidebarGroupContent>
        </div>
      </SidebarGroup>

      {/* ⭐ RECURRING INVOICES (Orbital Engine) */}
      <SidebarGroup className="mt-4">
        <button
          onClick={() => setRecurringOpen(!recurringOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-slate-500 uppercase text-xs font-semibold hover:bg-slate-100 rounded"
        >
          <span>Recurring</span>
          <ChevronDown size={16} className={`transition-transform ${recurringOpen ? "rotate-180" : ""}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ${recurringOpen ? "max-h-[1000px]" : "max-h-0"}`}>
          <SidebarGroupContent>

            <SidebarMenuItem>
              <Link
                href="/recurring-invoices"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname.startsWith("/recurring-invoices") &&
                  !router.pathname.includes("/history")
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <History size={16} />
                <span>Schedules</span>
              </Link>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <Link
                href="/recurring-invoices/new"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname === "/recurring-invoices/new"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <History size={16} />
                <span>New Schedule</span>
              </Link>
            </SidebarMenuItem>

          </SidebarGroupContent>
        </div>
      </SidebarGroup>

      {/* ⭐ PAYMENTS (Stripe Cockpit) */}
      <SidebarGroup className="mt-4">
        <button
          onClick={() => setPaymentsOpen(!paymentsOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-slate-500 uppercase text-xs font-semibold hover:bg-slate-100 rounded"
        >
          <span>Payments</span>
          <ChevronDown size={16} className={`transition-transform ${paymentsOpen ? "rotate-180" : ""}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ${paymentsOpen ? "max-h-[1000px]" : "max-h-0"}`}>
          <SidebarGroupContent>

            <SidebarMenuItem>
              <Link
                href="/payments"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname === "/payments"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <PoundSterling size={16} />
                <span>Payment Radar</span>
              </Link>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <Link
                href="/payments/payouts"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname === "/payments/payouts"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <PoundSterling size={16} />
                <span>Payouts</span>
              </Link>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <Link
                href="/payments/transactions"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname === "/payments/transactions"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <PoundSterling size={16} />
                <span>Transactions</span>
              </Link>
            </SidebarMenuItem>

          </SidebarGroupContent>
        </div>
      </SidebarGroup>

      {/* ⭐ SETTINGS */}
      <SidebarGroup className="mt-4">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-slate-500 uppercase text-xs font-semibold hover:bg-slate-100 rounded"
        >
          <span>Settings</span>
          <ChevronDown size={16} className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ${settingsOpen ? "max-h-[1000px]" : "max-h-0"}`}>
          <SidebarGroupContent>

            <SidebarMenuItem>
              <Link
                href="/settings/invoices"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname === "/settings/invoices"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate"
                                    }`}
              >
                <FileText size={16} />
                <span>Invoice Settings</span>
              </Link>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <Link
                href="/settings/payments"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname === "/settings/payments"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <PoundSterling size={16} />
                <span>Payment Settings</span>
              </Link>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <Link
                href="/settings/account"
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  router.pathname === "/settings/account"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Users size={16} />
                <span>Account Settings</span>
              </Link>
            </SidebarMenuItem>

          </SidebarGroupContent>
        </div>
      </SidebarGroup>

    </ul>
  );
}
