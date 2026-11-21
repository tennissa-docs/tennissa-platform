import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return v;
}

export const isProduction = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

export const env = {
  get databaseUrl() { return req("DATABASE_URL"); },
  get appUrl() { return req("APP_URL").replace(/\/$/, ""); },
  get authSecret() {
    const s = req("AUTH_SECRET");
    if (s.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
    return s;
  },
  get authProvider() { return process.env.AUTH_PROVIDER ?? "dev"; },
  get stripeSecretKey() { return process.env.STRIPE_SECRET_KEY ?? ""; },
  get stripePublishableKey() { return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""; },
  get stripeWebhookSecrets() {
    return [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];
  },
  get resendApiKey() { return process.env.RESEND_API_KEY ?? ""; },
  get emailFrom() { return process.env.EMAIL_FROM ?? "TENNISSA <receipts@example.org>"; },
  get givingOpensAt() { return new Date(process.env.GIVING_OPENS_AT ?? "2027-01-01T00:00:00-06:00"); },
};
