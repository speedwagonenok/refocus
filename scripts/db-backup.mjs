import "dotenv/config";

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const user = process.env.POSTGRES_USER;
const db = process.env.POSTGRES_DB;

if (!user || !db) {
  throw new Error("POSTGRES_USER and POSTGRES_DB are required in .env");
}

const outDir = path.join(process.cwd(), "backups");
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const file = path.join(outDir, `refocus-${stamp}.sql`);

const result = spawnSync(
  "docker",
  [
    "exec",
    "refocus-postgres",
    "pg_dump",
    "-U",
    user,
    "-d",
    db,
    "--no-owner",
    "--no-acl",
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

if (result.status !== 0) {
  console.error(result.stderr || result.error);
  process.exit(result.status ?? 1);
}

fs.writeFileSync(file, result.stdout);
console.log(`Backup saved: ${file}`);
