export function SidebarMenu({ children }) {
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

    // ✅ New MTD Dashboard link
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
