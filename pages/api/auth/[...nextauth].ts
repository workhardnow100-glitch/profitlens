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

/* -------------------------------------------------------
   CUSTOM USER LOOKUP (app_users)
------------------------------------------------------- */
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

/* -------------------------------------------------------
   MAGIC LINK TOKEN CREATION
   ACCOUNTANTS / ADMINS / FOUNDERS ALWAYS ALLOWED
------------------------------------------------------- */
PatchedAdapter.createVerificationToken = async (token) => {
  const { data: user } = await supabaseAdmin
    .from("app_users")
    .select("id, client_id, subscription_status, role")
    .eq("email", token.identifier)
    .single();

  if (!user) {
    await supabaseAdmin.from("audit").insert([
      {
        client_id: "unknown-client",
        actor_email: token.identifier,
        action: "MAGIC_LINK_BLOCKED",
        details: "User not found",
      },
    ]);
    throw new Error(`🚫 Magic link blocked: ${token.identifier} not found`);
  }

  // ⭐ ACCOUNTANTS / ADMINS / FOUNDERS ALWAYS ALLOWED
  if (["ACCOUNTANT", "ADMIN", "FOUNDER"].includes(user.role)) {
    const { data: inserted, error } = await supabaseAdmin
      .from("verification_tokens")
      .insert([
        {
          identifier: token.identifier,
          token: token.token,
          expires:
            typeof token.expires === "string"
              ? token.expires
              : token.expires.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Failed to insert verification token:", error);
      return null;
    }

    return inserted;
  }

  // ⭐ CLIENT LOGIN RULES (unchanged)
  const isActive = ["basic", "pro", "trialing"].includes(
    user.subscription_status
  );

  if (!user.client_id || !isActive) {
    await supabaseAdmin.from("audit").insert([
      {
        client_id: user.client_id ?? "unknown-client",
        actor_email: token.identifier,
        action: "MAGIC_LINK_BLOCKED",
        details: "Missing subscription or client ID",
      },
    ]);
    throw new Error(
      `🚫 Magic link blocked: ${token.identifier} lacks subscription or client ID`
    );
  }

  // Insert token for valid paying clients
  const { data: inserted, error } = await supabaseAdmin
    .from("verification_tokens")
    .insert([
      {
        identifier: token.identifier,
        token: token.token,
        expires:
          typeof token.expires === "string"
            ? token.expires
            : token.expires.toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Failed to insert verification token:", error);
    return null;
  }

  return inserted;
};

/* -------------------------------------------------------
   CONSUME VERIFICATION TOKEN
------------------------------------------------------- */
PatchedAdapter.useVerificationToken = async (token) => {
  const { data: consumed, error } = await supabaseAdmin
    .from("verification_tokens")
    .delete()
    .eq("token", token.token)
    .select()
    .single();

  if (error || !consumed) {
    console.error("Failed to consume verification token:", error);
    return null;
  }

  const { error: verifyErr } = await supabaseAdmin
    .from("app_users")
    .update({
      email_verified: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("email", consumed.identifier);

  if (verifyErr) {
    console.error("Failed to set email_verified on app_users:", verifyErr);
  }

  return consumed;
};

/* -------------------------------------------------------
   UPDATE USER
------------------------------------------------------- */
PatchedAdapter.updateUser = async (user) => {
  const updates: any = {
    updated_at: new Date().toISOString(),
  };
  if (user.name !== undefined) updates.name = user.name;
  if (user.image !== undefined) updates.image = user.image;
  if (user.emailVerified !== undefined && user.emailVerified !== null) {
    updates.email_verified =
      typeof user.emailVerified === "string"
        ? user.emailVerified
        : (user.emailVerified as Date).toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .update(updates)
    .eq("id", user.id)
    .select("id, email, name, email_verified")
    .single();

  if (error || !data) {
    console.error("Failed to update app_user:", error);
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name ?? null,
    emailVerified: data.email_verified ?? null,
  };
};

/* -------------------------------------------------------
   NEXTAUTH CONFIG
------------------------------------------------------- */
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
          .select("id, email, name, role, client_id")
          .eq("email", email)
          .single();

        if (error || !user) return null;

        await supabaseAdmin.from("audit").insert([
          {
            client_id: user.client_id ?? "unknown-client",
            actor_email: user.email,
            action: "LOGIN",
            details: "Credentials login successful",
          },
        ]);

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
    /* -------------------------------------------------------
       JWT CALLBACK
------------------------------------------------------- */
    async jwt({ token, user }) {
      if (user) {
        token.sub = String(user.id);
        token.email = user.email;
        token.role = (user as any).role ?? "USER";
      }

      if (token.email) {
        const { data: dbUser } = await supabaseAdmin
          .from("app_users")
          .select(
            "id, role, client_id, subscription_status, acting_client_id"
          )
          .eq("email", token.email.toLowerCase().trim())
          .single();

        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role ?? "USER";

          // ⭐ ACCOUNTANTS GET PRO ACCESS
          token.subscriptionStatus =
            dbUser.role === "ACCOUNTANT"
              ? "pro"
              : dbUser.subscription_status ?? "incomplete";

          token.clientId = dbUser.client_id ?? null;
          token.actingAsClientId = dbUser.acting_client_id ?? null;
        }
      }

      return token;
    },

    /* -------------------------------------------------------
       SESSION CALLBACK — accountant-aware enrichment
------------------------------------------------------- */
    async session({ session, token }) {
      session.user = {
        id: token.sub ?? "unknown",
        email: token.email ?? "unknown@example.com",
        role: token.role ?? "USER",
        clientId: token.clientId ?? null,
        subscriptionStatus: token.subscriptionStatus ?? "incomplete",
      };

      if (session.user.role === "ACCOUNTANT") {
        const { data: accessRows } = await supabaseAdmin
          .from("accountant_clients")
          .select("client_id")
          .eq("accountant_email", session.user.email);

        const accessibleClients = accessRows?.map((r) => r.client_id) || [];

        session.user.accessibleClients = accessibleClients;

        const persisted = token.actingAsClientId;
        const valid = accessibleClients.includes(persisted as string);

        // ⭐ ALWAYS DEFAULT TO FIRST CLIENT IF NONE SELECTED
        session.user.actingAsClientId = valid
          ? persisted
          : accessibleClients.length > 0
          ? accessibleClients[0]
          : null;
      } else {
        const cid = session.user.clientId ?? null;
        session.user.accessibleClients = cid ? [cid] : [];
        session.user.actingAsClientId = cid;
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
  },

  pages: {
    signIn: "/login",
    verifyRequest: "/login",
    newUser: "/dashboard",
  },
};

export default NextAuth(authOptions);
