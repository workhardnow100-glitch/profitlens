// hooks/useRouteGuard.js
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "./useUser";

export function useRouteGuard() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (loading) return;

    // No user → redirect to login
    if (!user) {
      router.replace("/login");
      return;
    }

    const role = user.role;
    const path = router.pathname;

    // Founder + Admin → full access everywhere
    if (role === "founder" || role === "admin") {
      return;
    }

    // Accountant-only routes (expandable later)
    const accountantRoutes = [
      "/accountant/dashboard",
      "/accountant/clients",
      "/accountant/client-overview",
    ];

    // User-only routes
    const userRoutes = [
      "/dashboard",
      "/transactions",
      "/vat",
      "/cis",
      "/sa",
      "/corp",
      "/reports",
      "/forms",
    ];

    // If accountant tries to access user-only pages → redirect to accountant dashboard
    if (role === "accountant" && userRoutes.includes(path)) {
      router.replace("/accountant/dashboard");
      return;
    }

    // If normal user tries to access accountant pages → redirect to user dashboard
    if (role === "user" && accountantRoutes.includes(path)) {
      router.replace("/dashboard");
      return;
    }

    // If role is unknown → fallback to login
    if (!["user", "accountant"].includes(role)) {
      router.replace("/login");
      return;
    }
  }, [user, loading, router]);
}
