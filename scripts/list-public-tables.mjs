import "dotenv/config";
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const tables = await client.query(`
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`);
console.log(tables.rows.map((row) => row.tablename).join("\n"));
await client.end();
