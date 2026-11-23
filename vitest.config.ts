import { defineConfig } from "vitest/config";
import path from "node:path";

// Money tests run against a scratch database (tennissa_test) rebuilt from replica/schema.sql each run,
// connected as the app's limited login, exactly like the running app.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: path.resolve(import.meta.dirname) + "/" },
      { find: /^server-only$/, replacement: path.resolve(import.meta.dirname, "tests/support/empty.ts") },
    ],
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/support/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    env: {
      DATABASE_URL: "postgres://tennissa_app:tennissa_app_dev@localhost:54329/tennissa_test",
      DATABASE_OWNER_URL: "postgres://postgres:postgres@localhost:54329/tennissa_test",
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "test-secret-test-secret-test-secret-0123456789",
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_dummy",
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
      DEV_CLOCK: "2027-01-15T10:00:00-06:00",
      GIVING_OPENS_AT: "2027-01-01T00:00:00-06:00",
      RESEND_API_KEY: "",
      INNGEST_DEV: "1",
    },
  },
});
