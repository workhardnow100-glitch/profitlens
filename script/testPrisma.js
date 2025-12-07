import { prisma } from "../lib/prisma";

async function test() {
  try {
    const statements = await prisma.statement.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    if (statements.length === 0) {
      console.log("⚠️ No statements found.");
    } else {
      console.log("✅ Retrieved statements:");
      statements.forEach(s => {
        console.log(`• ${s.name} (${s.format}) from ${s.source} on ${s.date}`);
      });
    }
  } catch (err) {
    console.error("❌ Prisma query failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
