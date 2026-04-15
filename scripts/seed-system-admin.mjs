import "dotenv/config";

import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg(
  new Pool({
    connectionString: databaseUrl,
  }),
);

const prisma = new PrismaClient({ adapter });

const email = process.env.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SYSTEM_ADMIN_PASSWORD;
const fullName =
  process.env.SYSTEM_ADMIN_FULL_NAME?.trim() || "Системный администратор";

if (!email) {
  throw new Error("SYSTEM_ADMIN_EMAIL is required");
}

if (!password) {
  throw new Error("SYSTEM_ADMIN_PASSWORD is required");
}

if (password.length < 8) {
  throw new Error("SYSTEM_ADMIN_PASSWORD must be at least 8 chars");
}

const passwordHash = await bcrypt.hash(password, 12);

await prisma.user.upsert({
  where: { email },
  update: {
    fullName,
    role: Role.SYSTEM_ADMIN,
    passwordHash,
  },
  create: {
    fullName,
    email,
    role: Role.SYSTEM_ADMIN,
    passwordHash,
  },
});

console.log(`System admin is ready: ${email}`);
await prisma.$disconnect();
