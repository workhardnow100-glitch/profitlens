import { prisma } from "../lib/prisma";

async function seed() {
  try {
    const user = await prisma.user.upsert({
      where: { email: "workhardnow100@gmail.com" },
      update: {},
      create: {
        email: "workhardnow100@gmail.com",
        name: "Dev Operator",
        role: "FOUNDER",
        subscriptionStatus: "active",
        clients: {
          create: {
            name: "Dev Client",
          },
        },
      },
      include: {
        clients: true,
      },
    });

    console.log("✅ Seeded user:", user.email);
    console.log("🔗 Linked client:", user.clients[0]?.name);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
