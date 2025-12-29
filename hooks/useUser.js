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

  // ⭐ Normalize actingAsClientId so it is ALWAYS null when not selected
  const normalizedActingId =
    session?.user?.actingAsClientId &&
    session.user.actingAsClientId !== "null" &&
    session.user.actingAsClientId !== "undefined" &&
    session.user.actingAsClientId !== ""
      ? session.user.actingAsClientId
      : null;

  const user = {
    id: session?.user?.id ?? null,
    email: session?.user?.email ?? "unknown@example.com",
    role: session?.user?.role?.toLowerCase() ?? "user",
    clientId: session?.user?.clientId ?? null,
    actingAsClientId: normalizedActingId,
    subscriptionStatus: session?.user?.subscriptionStatus ?? "incomplete",
  };

  return {
    user,
    status, // ⭐ REQUIRED by Tax Hub
    isLoading: status === "loading",
    isAuthenticated: !!session?.user,
    isPremium: ["basic", "pro"].includes(user.subscriptionStatus),
    isFounder: user.role === "admin",
    isAdmin: user.role === "admin",
  };
}
