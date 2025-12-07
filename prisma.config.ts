// prisma.config.ts
import path from "node:path";
import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

// Load env vars from .env.local (or .env if you prefer)
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts", // ✅ Windows-safe
  },
});

