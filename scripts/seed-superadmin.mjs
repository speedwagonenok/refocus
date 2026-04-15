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

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const fullName = process.env.SUPERADMIN_FULL_NAME?.trim() || "Суперадмин";

if (!email) {
  throw new Error("SUPERADMIN_EMAIL is required");
}

if (!password) {
  throw new Error("SUPERADMIN_PASSWORD is required");
}

if (password.length < 8) {
  throw new Error("SUPERADMIN_PASSWORD must be at least 8 chars");
}

const passwordHash = await bcrypt.hash(password, 12);

await prisma.user.upsert({
  where: { email },
  update: {
    fullName,
    role: Role.SUPERADMIN,
    passwordHash,
  },
  create: {
    fullName,
    email,
    role: Role.SUPERADMIN,
    passwordHash,
  },
});

console.log(`Superadmin is ready: ${email}`);
await prisma.$disconnect();
