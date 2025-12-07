// types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string; // ✅ Required for session.user.id
      name?: string | null;
      email: string;
      role: "FOUNDER" | "ACCOUNTANT" | "ADMIN" | "USER";
      clientId: string | null;
      subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
    };
  }

  interface User {
    id: string | number;
    email: string;
    role?: "FOUNDER" | "ACCOUNTANT" | "ADMIN" | "USER" | null;
    clientId?: string | null;
    subscriptionStatus?: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    email?: string;
    role?: "FOUNDER" | "ACCOUNTANT" | "ADMIN" | "USER";
    clientId?: string | null;
    subscriptionStatus?: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  }
}

