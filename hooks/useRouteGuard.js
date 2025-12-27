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

    const role = (user.role || "").toLowerCase();
    const path = router.pathname;

    // Founder + Admin → full access everywhere
    if (role === "founder" || role === "admin") {
      return;
    }

    // ⭐ Accountant must have an acting client to access user pages
    if (role === "accountant") {
      if (!user.actingAsClientId) {
        // No acting client selected → send to accountant dashboard
        router.replace("/accountant/dashboard");
        return;
      }

      // Accountant WITH acting client → full access to ALL pages
      return;
    }

    // ⭐ Normal user rules
    const accountantRoutes = [
      "/accountant/dashboard",
      "/accountant/clients",
      "/accountant/client-overview",
    ];

    if (role === "user" && accountantRoutes.includes(path)) {
      router.replace("/dashboard");
      return;
    }

    // Unknown role → login
    if (!["user", "accountant"].includes(role)) {
      router.replace("/login");
      return;
    }
  }, [user, loading, router]);
}
