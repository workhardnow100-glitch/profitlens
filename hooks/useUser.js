import { useSession } from "next-auth/react";
import { useEffect } from "react";

export function useUser() {
  const { data: session, status } = useSession();

  useEffect(() => {
    console.log("🔍 useUser session:", session);
    console.log("🔍 useUser status:", status);
    if (session?.user) {
      console.log("✅ Extracted user:", {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        clientId: session.user.actingAsClientId ?? session.user.clientId,
        actingAsClientId: session.user.actingAsClientId,
        subscriptionStatus: session.user.subscriptionStatus,
      });
    } else {
      console.warn("⚠️ No session.user found");
    }
  }, [session, status]);

  const user = {
    id: session?.user?.id ?? null,
    email: session?.user?.email ?? "unknown@example.com",
    role: session?.user?.role?.toLowerCase() ?? "user",
    clientId: session?.user?.clientId ?? null,
    actingAsClientId: session?.user?.actingAsClientId ?? null,
    subscriptionStatus: session?.user?.subscriptionStatus ?? "incomplete",
  };

  return {
    user,
    status, // ⭐ FIX: return status so pages don't freeze
    isLoading: status === "loading",
    isAuthenticated: !!session?.user,
    isPremium: ["basic", "pro"].includes(user.subscriptionStatus),
    isFounder: user.role === "admin",
    isAdmin: user.role === "admin",
  };
}
