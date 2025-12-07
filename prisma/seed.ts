// seed.ts
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const email = "workhardnow100@gmail.com";
  const password = "SecurePassword123!"; // Replace with a secure value

  // Step 1: Create Supabase Auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authUser?.user?.id) {
    throw new Error(`❌ Supabase Auth user creation failed: ${authError?.message}`);
  }

  const authId = authUser.user.id;

  // Step 2: Wait for internal_users trigger to populate
  let internalUserId: number | null = null;
  for (let i = 0; i < 10; i++) {
    const { data: internalUser } = await supabase
      .from("internal_users")
      .select("id")
      .eq("auth_id", authId)
      .single();

    if (internalUser?.id) {
      internalUserId = internalUser.id;
      break;
    }

    console.log("⏳ Waiting for internal_users trigger...");
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!internalUserId) {
    throw new Error("❌ internal_users mapping not found after timeout");
  }

  // Step 3: Create client linked to internal user
  const existingClient = await prisma.client.findFirst({
    where: { userId: internalUserId },
  });

  if (!existingClient) {
    await prisma.client.create({
      data: {
        name: "Brendan Client",
        email,
        userId: internalUserId,
      },
    });
  }

  console.log(`✅ Seeded Supabase Auth user + internal_user + client for ${email}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
  })
  .finally(() => prisma.$disconnect());
