import "dotenv/config";

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const user = process.env.POSTGRES_USER;
const db = process.env.POSTGRES_DB;
const file = process.argv[2];

if (!user || !db) {
  throw new Error("POSTGRES_USER and POSTGRES_DB are required in .env");
}

if (!file) {
  console.error("Usage: npm run db:restore -- backups/refocus-....sql");
  process.exit(1);
}

const dumpPath = path.resolve(file);
if (!fs.existsSync(dumpPath)) {
  console.error(`File not found: ${dumpPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(dumpPath, "utf8");
const result = spawnSync(
  "docker",
  ["exec", "-i", "refocus-postgres", "psql", "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || result.error);
  process.exit(result.status ?? 1);
}

console.log(`Restored from ${dumpPath}`);
