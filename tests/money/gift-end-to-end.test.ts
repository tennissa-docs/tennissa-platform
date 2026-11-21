import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import Stripe from "stripe";
import { sql } from "@/lib/db";
import { setStripeGatewayForTests, type StripeGateway } from "@/lib/stripe";
import { createGift, GiveError } from "@/lib/give/create-gift";
import { processProviderEvent, storeProviderEvent } from "@/lib/give/process-event";
import { sendReceipt } from "@/lib/give/send-receipt";
import type { GiveInput } from "@/lib/give/schema";
import { POST as webhook } from "@/app/api/stripe/webhook/route";

// A stand-in for Stripe: deterministic PaymentIntents per idempotency key, and a fixed fee as the
// "balance transaction" would report it. The app never computes fees; the test just supplies one.
const FEE = 80n;
const created: { key: string; account?: string; amount: bigint }[] = [];
const fake: StripeGateway = {
  async createPaymentIntent(p) {
    created.push({ key: p.idempotencyKey, account: p.account, amount: p.amountCents });
    const id = "pi_" + createHash("sha256").update(p.idempotencyKey).digest("hex").slice(0, 20);
    return { id, clientSecret: `${id}_secret_x` };
  },
  async retrievePaymentIntent(id) { return { id, status: "processing" }; },
  async chargeFacts(id) { return { chargeId: "ch_" + id.slice(3), feeCents: FEE, balanceTransactionId: "txn_" + id.slice(3) }; },
};

function input(over: Partial<GiveInput> = {}): GiveInput {
  return {
    checkoutId: randomUUID(), filingStatus: "single", amountCents: 100, firstName: "Amina", lastName: "Haddad",
    email: "amina@example.com", address: { line1: "12 Elm St", line2: "", city: "Nashville", state: "TN", zip: "37201" },
    method: "card", forTaxCredit: true, attestUsPerson: true, attestOwnMoney: true, consentEmailStatements: true, ...over,
  };
}

function event(type: string, piId: string, amount: number, id = "evt_" + randomUUID().replace(/-/g, "")): Stripe.Event {
  return {
    id, type, object: "event", api_version: "2025-01-01", created: Math.floor(Date.parse("2027-01-15T16:05:00Z") / 1000),
    livemode: false, pending_webhooks: 1, request: null,
    data: { object: { id: piId, object: "payment_intent", amount, amount_received: amount } },
  } as unknown as Stripe.Event;
}

async function piFor(checkoutId: string): Promise<string> {
  const [d] = await sql`select stripe_payment_intent_id from donations where checkout_id = ${checkoutId}`;
  return d.stripe_payment_intent_id;
}

async function trialBalance() {
  const [t] = await sql`select coalesce(sum(debits_cents),0)::bigint as d, coalesce(sum(credits_cents),0)::bigint as c from trial_balance`;
  return { debits: BigInt(t.d), credits: BigInt(t.c) };
}

async function balance(key: string): Promise<bigint> {
  const [b] = await sql`select balance_cents from account_balances where key = ${key}`;
  return BigInt(b.balance_cents);
}

beforeAll(() => setStripeGatewayForTests(fake));
afterAll(async () => { setStripeGatewayForTests(null); await sql.end(); });
beforeEach(() => { created.length = 0; });

describe("one dollar, end to end", () => {
  it("charges at checkout, books once on a replayed webhook, and the trial balance is $0", async () => {
    const gift = await createGift(input({ amountCents: 100 }));
    expect(gift.clientSecret).toMatch(/^pi_/);
    expect(gift.thanksPath).toContain(`/give/thanks/${gift.checkoutId}?t=`);
    expect(created).toHaveLength(1);
    expect(created[0].key).toBe(`checkout:${gift.checkoutId}:1`);

    const [pending] = await sql`select status, qualified_25f, state, tax_year, method from donations where checkout_id = ${gift.checkoutId}`;
    expect(pending).toMatchObject({ status: "pending", qualified_25f: true, state: "TN", tax_year: 2027, method: "card" });

    const pi = await piFor(gift.checkoutId);
    const ev = event("payment_intent.succeeded", pi, 100);
    expect((await storeProviderEvent(ev)).stored).toBe(true);
    expect((await storeProviderEvent(ev)).stored).toBe(false); // the replay is the same row

    const first = await processProviderEvent(ev.id);
    expect(first.outcome).toBe("booked");
    expect((await processProviderEvent(ev.id)).outcome).toBe("already_processed");

    // a second, different succeeded event for the same payment never books it twice
    const dup = event("payment_intent.succeeded", pi, 100);
    await storeProviderEvent(dup);
    expect((await processProviderEvent(dup.id)).outcome).toBe("no_change");

    const [d] = await sql`select status, confirmation_no, fee_cents, received_on::text from donations where checkout_id = ${gift.checkoutId}`;
    expect(d.status).toBe("succeeded");
    expect(d.confirmation_no).toBe("R-2027-0001");
    expect(BigInt(d.fee_cents)).toBe(FEE);
    expect(d.received_on).toBe("2027-01-15");

    const entries = await sql`select idempotency_key from journal_entries order by created_at`;
    expect(entries.map((e) => e.idempotency_key)).toEqual([`${ev.id}:gift`, `${ev.id}:fee`]);

    const tb = await trialBalance();
    expect(tb.debits).toBe(tb.credits);
    expect(tb.debits - tb.credits).toBe(0n);
    expect(await balance("asset:stripe:25f:TN")).toBe(100n - FEE);
    expect(await balance("income:contributions:25f:TN")).toBe(100n);
    expect(await balance("expense:fees:processing")).toBe(FEE);
  });

  it("emails the receipt once and logs it", async () => {
    const [d] = await sql`select id from donations where confirmation_no = 'R-2027-0001'`;
    expect(await sendReceipt(d.id)).toBe("sent");
    expect(await sendReceipt(d.id)).toBe("already_sent");
    const [r] = await sql`select emailed_at from receipts where donation_id = ${d.id}`;
    expect(r.emailed_at).not.toBeNull();
    const logs = await sql`select kind, recipient_email from notification_log where subject_id = ${d.id}`;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ kind: "receipt", recipient_email: "amina@example.com" });
  });

  it("is idempotent per checkout: a double-clicked Give creates one donation and one PaymentIntent", async () => {
    const i = input({ email: "twice@example.com" });
    const a = await createGift(i);
    const b = await createGift(i);
    expect(a.clientSecret).toBe(b.clientSecret);
    const rows = await sql`select id from donations where checkout_id = ${i.checkoutId}`;
    expect(rows).toHaveLength(1);
    expect(new Set(created.map((c) => c.key)).size).toBe(1);
  });

  it("moves an ACH gift through processing, and a failed one books nothing", async () => {
    const ach = await createGift(input({ method: "ach", email: "bank@example.com", amountCents: 2500 }));
    const pi = await piFor(ach.checkoutId);
    const proc = event("payment_intent.processing", pi, 2500);
    await storeProviderEvent(proc);
    expect(await processProviderEvent(proc.id)).toMatchObject({ outcome: "status", status: "processing" });

    const failed = await createGift(input({ method: "ach", email: "bounce@example.com", amountCents: 900 }));
    const fpi = await piFor(failed.checkoutId);
    const fev = event("payment_intent.payment_failed", fpi, 900);
    await storeProviderEvent(fev);
    await processProviderEvent(fev.id);
    const [f] = await sql`select status, confirmation_no from donations where checkout_id = ${failed.checkoutId}`;
    expect(f).toMatchObject({ status: "failed", confirmation_no: null });
    const [{ n }] = await sql`select count(*)::int as n from journal_entries j join donations d on d.id = j.source_id
      where d.checkout_id = ${failed.checkoutId}`;
    expect(n).toBe(0);
  });

  it("numbers receipts sequentially within the year", async () => {
    const g = await createGift(input({ email: "second@example.com", amountCents: 5000 }));
    const ev = event("payment_intent.succeeded", await piFor(g.checkoutId), 5000);
    await storeProviderEvent(ev);
    await processProviderEvent(ev.id);
    const [d] = await sql`select confirmation_no from donations where checkout_id = ${g.checkoutId}`;
    expect(d.confirmation_no).toBe("R-2027-0002");
  });

  it("a regular gift (credit box unticked) goes to the general account", async () => {
    const g = await createGift(input({ email: "general@example.com", amountCents: 1000, forTaxCredit: false }));
    const ev = event("payment_intent.succeeded", await piFor(g.checkoutId), 1000);
    await storeProviderEvent(ev);
    await processProviderEvent(ev.id);
    const [d] = await sql`select qualified_25f, state from donations where checkout_id = ${g.checkoutId}`;
    expect(d).toMatchObject({ qualified_25f: false, state: null });
    expect(await balance("income:contributions:general")).toBe(1000n);
    const tb = await trialBalance();
    expect(tb.debits).toBe(tb.credits);
  });

  it("refuses an amount the Stripe event disagrees with, and records the error", async () => {
    const g = await createGift(input({ email: "mismatch@example.com", amountCents: 700 }));
    const ev = event("payment_intent.succeeded", await piFor(g.checkoutId), 701);
    await storeProviderEvent(ev);
    await expect(processProviderEvent(ev.id)).rejects.toThrow(/amount mismatch/);
    const [p] = await sql`select processed_at, error from provider_events where stripe_event_id = ${ev.id}`;
    expect(p.processed_at).toBeNull();
    expect(p.error).toMatch(/amount mismatch/);
  });
});

describe("the $1,700 credit cap", () => {
  it("allows up to the cap and refuses one cent more, counting gifts still processing", async () => {
    const email = "cap@example.com";
    await createGift(input({ email, amountCents: 120_000, method: "ach" }));
    await createGift(input({ email, amountCents: 50_000 }));
    const over = createGift(input({ email, amountCents: 1 }));
    await expect(over).rejects.toBeInstanceOf(GiveError);
    await expect(createGift(input({ email, amountCents: 1 }))).rejects.toThrow(/credit limit for 2027/);
    // a regular gift is still welcome
    await expect(createGift(input({ email, amountCents: 1, forTaxCredit: false }))).resolves.toBeTruthy();
  });

  it("doesn't count a failed gift", async () => {
    const email = "capfail@example.com";
    const g = await createGift(input({ email, amountCents: 170_000 }));
    const ev = event("payment_intent.payment_failed", await piFor(g.checkoutId), 170_000);
    await storeProviderEvent(ev);
    await processProviderEvent(ev.id);
    await expect(createGift(input({ email, amountCents: 170_000 }))).resolves.toBeTruthy();
  });
});

describe("giving opens after January 1, 2027", () => {
  it("refuses gifts before the opening moment", async () => {
    const before = process.env.GIVING_OPENS_AT;
    process.env.GIVING_OPENS_AT = "2027-06-01T00:00:00-05:00";
    try {
      await expect(createGift(input({ email: "early@example.com" }))).rejects.toThrow(/opens on January 1, 2027/);
    } finally {
      process.env.GIVING_OPENS_AT = before;
    }
  });
});

describe("POST /api/stripe/webhook", () => {
  it("rejects a bad signature and books a signed, replayed event once", async () => {
    const g = await createGift(input({ email: "hook@example.com", amountCents: 300 }));
    const ev = event("payment_intent.succeeded", await piFor(g.checkoutId), 300);
    const payload = JSON.stringify(ev);
    const stripe = new Stripe("sk_test_dummy");
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
    const send = (sig: string) => webhook(new Request("http://localhost/api/stripe/webhook", {
      method: "POST", body: payload, headers: { "stripe-signature": sig },
    }));

    expect((await send("t=1,v1=nope")).status).toBe(400);
    const r1 = await send(header);
    expect(r1.status).toBe(200);
    expect(await r1.json()).toMatchObject({ outcome: "booked" });
    const r2 = await send(header);
    expect(await r2.json()).toMatchObject({ outcome: "already_processed" });
    const [{ n }] = await sql`select count(*)::int as n from journal_entries where idempotency_key like ${ev.id + ":%"}`;
    expect(n).toBe(2);
    const tb = await trialBalance();
    expect(tb.debits).toBe(tb.credits);
  });
});
