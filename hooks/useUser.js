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
        clientId: session.user.clientId,
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
    subscriptionStatus: session?.user?.subscriptionStatus ?? "incomplete",
  };

  return {
    user,
    isLoading: status === "loading",
    isAuthenticated: !!session?.user,
    isPremium: ["basic", "pro"].includes(user.subscriptionStatus),
    isFounder: user.role === "admin", // ✅ matches session enrichment
    isAdmin: user.role === "admin",   // ✅ same check
  };
}
