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

    const path = router.pathname;

    // Admin can access everything
    if (user.role === "admin") return;

    // Accountant-only routes
    const accountantRoutes = ["/accountant/dashboard"];

    // User-only routes
    const userRoutes = ["/dashboard"];

    // ✅ Accountant trying to access user pages
    if (user.role === "accountant" && userRoutes.includes(path)) {
      router.replace("/accountant/dashboard");
      return;
    }

    // ✅ User trying to access accountant pages
    if (user.role === "user" && accountantRoutes.includes(path)) {
      router.replace("/dashboard");
      return;
    }
  }, [user, loading, router]);
}
