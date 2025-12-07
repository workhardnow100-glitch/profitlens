// pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { supabaseAdmin } from "../../../lib/supabase-admin";

// Logging proxy to trace adapter calls
const LoggingAdapter = (adapter: any) =>
  new Proxy(adapter, {
    get(target, prop) {
      const value = (target as any)[prop];
      if (typeof value !== "function") return value;
      return async (...args: any[]) => {
        console.log(`[Adapter] ${String(prop)}`, ...args);
        return value.apply(target, args);
      };
    },
  });

const BaseAdapter = SupabaseAdapter({
  url: process.env.SUPABASE_URL!,
  secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

const PatchedAdapter: any = { ...BaseAdapter };

// ✅ Override getUserByEmail to pull from app_users
PatchedAdapter.getUserByEmail = async (email: string) => {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, name, role")
    .eq("email", email)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name ?? null,
    emailVerified: null,
  };
};

// ✅ Insert verification tokens into public.verification_tokens
PatchedAdapter.createVerificationToken = async (token) => {
  const { data: user } = await supabaseAdmin
    .from("app_users")
    .select("id, client_id, subscription_status")
    .eq("email", token.identifier)
    .single();

  if (!user) {
    // Audit log: blocked attempt
    await supabaseAdmin.from("audit").insert([{
      client_id: "unknown-client",
      actor_email: token.identifier,
      action: "MAGIC_LINK_BLOCKED",
      details: "User not found",
    }]);
    throw new Error(`🚫 Magic link blocked: ${token.identifier} not found`);
  }

  const isActive = ["basic", "pro"].includes(user.subscription_status);
  if (!user.client_id || !isActive) {
    await supabaseAdmin.from("audit").insert([{
      client_id: user.client_id ?? "unknown-client",
      actor_email: token.identifier,
      action: "MAGIC_LINK_BLOCKED",
      details: "Missing subscription or client ID",
    }]);
    throw new Error(
      `🚫 Magic link blocked: ${token.identifier} lacks subscription or client ID`
    );
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("verification_tokens")
    .insert([{
      identifier: token.identifier,
      token: token.token,
      expires: typeof token.expires === "string"
        ? token.expires
        : token.expires.toISOString(),
    }])
    .select()
    .single();

  if (error) {
    console.error("Failed to insert verification token:", error);
    return null;
  }

  return inserted;
};

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST!,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
        auth: {
          user: process.env.EMAIL_SERVER_USER!,
          pass: process.env.EMAIL_SERVER_PASS!,
        },
      },
      from: process.env.EMAIL_FROM!,
      maxAge: 10 * 60,
    }),

    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "text" },
        pin: { label: "Founder PIN", type: "password" },
      },
      async authorize(credentials): Promise<any> {
        const email = credentials?.email?.toLowerCase().trim();
        const pin = credentials?.pin?.trim();
        if (!email) return null;

        const founderEmail = process.env.FOUNDER_EMAIL?.toLowerCase().trim();
        if (email === founderEmail) {
          if (pin !== process.env.FOUNDER_PIN) {
            throw new Error("🚫 Invalid founder PIN");
          }
        }

        const { data: user, error } = await supabaseAdmin
          .from("app_users")
          .select("id, email, name, role, client_id") // ✅ include client_id
          .eq("email", email)
          .single();

        if (error || !user) return null;

        // ✅ Audit log: successful credentials login
        await supabaseAdmin.from("audit").insert([{
          client_id: user.client_id ?? "unknown-client",
          actor_email: user.email, // ✅ correct column name
          action: "LOGIN",
          details: "Credentials login successful",
        }]);

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? null,
          role: user.role ?? "USER",
        };
      },
    }),
  ],

  adapter: LoggingAdapter(PatchedAdapter),

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user?.email && !token.email) {
        token.email = user.email;
        token.sub = String(user.id);
        token.role = (user as any).role ?? "USER";
      }

      const email = token.email?.toLowerCase().trim();
      if (!email) return token;

      const { data: dbUser, error } = await supabaseAdmin
        .from("app_users")
        .select("id, role, client_id, subscription_status")
        .eq("email", email)
        .single();

      if (error || !dbUser) {
        token.role = "USER";
        token.clientId = "unknown-client";
        token.subscriptionStatus = "incomplete";
        return token;
      }

      token.sub = dbUser.id;
      token.role = dbUser.role ?? "USER";
      token.clientId = dbUser.client_id ?? "unknown-client";
      token.subscriptionStatus = dbUser.subscription_status ?? "incomplete";

      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.sub ?? "unknown",
        email: token.email ?? "unknown@example.com",
        role: token.role ?? "USER",
        clientId: token.clientId ?? "unknown-client",
        subscriptionStatus: token.subscriptionStatus ?? "incomplete",
      };
      console.log("🔍 Session enrichment:", session.user);
      return session;
    },
  },

  pages: { signIn: "/login" },
};

export default NextAuth(authOptions);
