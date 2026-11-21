// Applies migrations as the database OWNER (DATABASE_OWNER_URL). The running app never uses this login.
//   npm run db:migrate            apply pending migrations, ensure the tennissa_app login exists (local)
//   npm run db:reset              local only: drop and recreate the database, migrate, seed
import { config } from "dotenv";
import postgres from "postgres";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config();

const ownerUrl = process.env.DATABASE_OWNER_URL;
if (!ownerUrl) throw new Error("DATABASE_OWNER_URL is not set (see .env.example)");
const appUrl = process.env.DATABASE_URL;

// Migration 0001 is replica/schema.sql (tested by replica/db-tests). Later ones live in db/migrations.
function migrations(): { name: string; file: string }[] {
  const list = [{ name: "0001_schema", file: path.resolve("replica/schema.sql") }];
  const dir = path.resolve("db/migrations");
  try {
    for (const f of readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()) {
      if (f.startsWith("0001")) continue;
      list.push({ name: f.replace(/\.sql$/, ""), file: path.join(dir, f) });
    }
  } catch { /* no extra migrations yet */ }
  return list;
}

async function reset() {
  const u = new URL(ownerUrl!);
  if (!["localhost", "127.0.0.1"].includes(u.hostname)) throw new Error("db:reset only runs against a local database");
  const dbName = u.pathname.slice(1);
  u.pathname = "/postgres";
  const admin = postgres(u.toString(), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.unsafe(`create database "${dbName}"`);
  await admin.end();
  console.log(`reset: recreated local database ${dbName}`);
}

async function main() {
  if (process.argv.includes("--reset")) await reset();
  const sql = postgres(ownerUrl!, { max: 1, onnotice: () => {} });
  await sql.unsafe(`create schema if not exists ops;
    create table if not exists ops.migrations (name text primary key, sha256 text not null, applied_at timestamptz not null default now());
    revoke all on schema ops from public;`);
  for (const m of migrations()) {
    const text = readFileSync(m.file, "utf8");
    const hash = createHash("sha256").update(text).digest("hex");
    const [done] = await sql`select sha256 from ops.migrations where name = ${m.name}`;
    if (done) {
      if (done.sha256 !== hash) console.warn(`warning: ${m.name} changed after it was applied; write a new migration instead`);
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into ops.migrations (name, sha256) values (${m.name}, ${hash})`;
    });
    console.log(`applied ${m.name}`);
  }

  // The app's login: a member of app_runtime, so it inherits exactly app_runtime's limited rights.
  if (appUrl) {
    const u = new URL(appUrl);
    const login = decodeURIComponent(u.username);
    const local = ["localhost", "127.0.0.1"].includes(u.hostname);
    const [exists] = await sql`select 1 from pg_roles where rolname = ${login}`;
    if (!exists) {
      if (!local) throw new Error(`login ${login} does not exist; create it by hand on non-local databases`);
      const pw = process.env.APP_DB_PASSWORD;
      if (!pw) throw new Error("APP_DB_PASSWORD is not set");
      await sql.unsafe(`create role "${login}" login password '${pw.replace(/'/g, "''")}' in role app_runtime`);
      console.log(`created login ${login} (member of app_runtime)`);
    }
  }
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
