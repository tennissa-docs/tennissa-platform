import "server-only";
import Stripe from "stripe";
import { env, isProduction } from "@/lib/env";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (client) return client;
  const key = env.stripeSecretKey;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set (see .env.example)");
  if (!isProduction && !key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("Use Stripe TEST keys outside production");
  }
  client = new Stripe(key, { appInfo: { name: "tennissa-platform" } });
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.stripeSecretKey && env.stripePublishableKey);
}

/** processor_accounts.stripe_account_id is a real connected account (acct_…) or a test placeholder on the platform. */
export function connectedAccount(stripeAccountId: string): string | undefined {
  return stripeAccountId.startsWith("acct_") ? stripeAccountId : undefined;
}

// The few Stripe calls the money code makes, behind one seam so tests can stand in for Stripe.
export type StripeGateway = {
  createPaymentIntent(p: {
    amountCents: bigint; method: "ach" | "card"; description: string; metadata: Record<string, string>;
    idempotencyKey: string; account?: string; email: string; statementDescriptorSuffix?: string;
  }): Promise<{ id: string; clientSecret: string }>;
  retrievePaymentIntent(id: string, account?: string): Promise<{ id: string; status: string }>;
  /** The charge behind a succeeded PaymentIntent and its fee from the balance transaction. */
  chargeFacts(paymentIntentId: string, account?: string): Promise<{ chargeId: string; feeCents: bigint; balanceTransactionId: string } | null>;
};

const live: StripeGateway = {
  async createPaymentIntent(p) {
    const pi = await stripe().paymentIntents.create(
      {
        amount: Number(p.amountCents),
        currency: "usd",
        allowed_payment_method_types: [p.method === "ach" ? "us_bank_account" : "card"],
        ...(p.method === "ach"
          ? { payment_method_options: { us_bank_account: { verification_method: "automatic", financial_connections: { permissions: ["payment_method"] } } } }
          : {}),
        description: p.description,
        metadata: p.metadata,
        ...(p.method === "card" && p.statementDescriptorSuffix ? { statement_descriptor_suffix: p.statementDescriptorSuffix } : {}),
      },
      { idempotencyKey: p.idempotencyKey, ...(p.account ? { stripeAccount: p.account } : {}) },
    );
    if (!pi.client_secret) throw new Error("Stripe returned no client secret");
    return { id: pi.id, clientSecret: pi.client_secret };
  },
  async retrievePaymentIntent(id, account) {
    const pi = await stripe().paymentIntents.retrieve(id, {}, account ? { stripeAccount: account } : undefined);
    return { id: pi.id, status: pi.status };
  },
  async chargeFacts(paymentIntentId, account) {
    const pi = await stripe().paymentIntents.retrieve(
      paymentIntentId, { expand: ["latest_charge.balance_transaction"] }, account ? { stripeAccount: account } : undefined,
    );
    const charge = pi.latest_charge;
    if (!charge || typeof charge === "string") return null;
    const bt = charge.balance_transaction;
    if (!bt || typeof bt === "string") return null;
    return { chargeId: charge.id, feeCents: BigInt(bt.fee), balanceTransactionId: bt.id };
  },
};

let gateway: StripeGateway = live;
export function stripeGateway(): StripeGateway { return gateway; }
/** Tests only. */
export function setStripeGatewayForTests(g: StripeGateway | null) { gateway = g ?? live; }
