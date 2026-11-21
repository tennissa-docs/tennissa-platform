import { execFileSync } from "node:child_process";

// Rebuild the scratch database: drop, create, migrate (replica/schema.sql), seed. Local only.
export default function setup() {
  const env = {
    ...process.env,
    DATABASE_OWNER_URL: "postgres://postgres:postgres@localhost:54329/tennissa_test",
    DATABASE_URL: "postgres://tennissa_app:tennissa_app_dev@localhost:54329/tennissa_test",
    APP_DB_PASSWORD: "tennissa_app_dev",
    DOTENV_CONFIG_QUIET: "true",
  };
  const tsx = "node_modules/tsx/dist/cli.mjs";
  const opts = { env, stdio: "inherit" as const };
  execFileSync(process.execPath, [tsx, "scripts/migrate.ts", "--reset"], opts);
  execFileSync(process.execPath, [tsx, "scripts/seed.ts"], opts);
}
