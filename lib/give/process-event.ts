import "server-only";
import type Stripe from "stripe";
import { sql, type Tx } from "@/lib/db";
import { orgDate } from "@/lib/clock";
import { connectedAccount, stripeGateway } from "@/lib/stripe";
import { postGiftFee, postGiftSucceeded } from "@/lib/ledger/post";

/** Every webhook event goes into provider_events first. A replayed event is the same row (unique stripe_event_id). */
export async function storeProviderEvent(event: Stripe.Event): Promise<{ stored: boolean }> {
  const obj = event.data.object as { id?: string; amount?: number };
  const rows = await sql`
    insert into provider_events (stripe_event_id, type, stripe_account_id, object_id, amount_cents, payload)
    values (${event.id}, ${event.type}, ${event.account ?? null}, ${obj.id ?? null},
            ${typeof obj.amount === "number" ? obj.amount : null}, ${sql.json(JSON.parse(JSON.stringify(event)))})
    on conflict (stripe_event_id) do nothing
    returning id`;
  return { stored: rows.length > 0 };
}

export type ProcessResult =
  | { outcome: "already_processed" }
  | { outcome: "ignored"; type: string }
  | { outcome: "status"; donationId: string | null; status: string }
  | { outcome: "booked"; donationId: string; entryId: string; sendReceipt: boolean }
  | { outcome: "fee"; donationId: string; entryId: string | null }
  | { outcome: "no_change"; donationId: string };

type ChargeFacts = { chargeId: string; feeCents: bigint; balanceTransactionId: string };
type GiftRow = {
  id: string; org_id: string; amount_cents: string; fee_cents: string; qualified_25f: boolean; state: string | null;
  confirmation_no: string | null; succeeded_at: Date | null;
};

/** Records the fee on the gift and posts its entry, once. The database refuses to change a fee once it is non-zero. */
async function bookFee(tx: Tx, d: GiftRow, facts: ChargeFacts, occurredAt: Date) {
  if (!d.confirmation_no || BigInt(d.fee_cents) !== 0n) return null;
  await tx`update donations set fee_cents = ${facts.feeCents.toString()}, stripe_charge_id = coalesce(stripe_charge_id, ${facts.chargeId})
    where id = ${d.id}`;
  const g = { id: d.id, orgId: d.org_id, amountCents: BigInt(d.amount_cents), qualified25f: d.qualified_25f, state: d.state, confirmationNo: d.confirmation_no };
  const fee = await postGiftFee(tx, g, facts.feeCents, facts.balanceTransactionId, occurredAt);
  await tx`insert into audit_events (org_id, action, subject_type, subject_id, detail)
    values (${d.org_id}, 'donation.fee_recorded', 'donation', ${d.id},
      ${tx.json({ fee_cents: facts.feeCents.toString(), balance_transaction: facts.balanceTransactionId })})`;
  return fee;
}

function paymentIntentOf(event: Stripe.Event): string | null {
  if (event.type.startsWith("payment_intent.")) return (event.data.object as Stripe.PaymentIntent).id;
  if (event.type === "charge.updated") {
    const pi = (event.data.object as Stripe.Charge).payment_intent;
    return typeof pi === "string" ? pi : pi?.id ?? null;
  }
  return null;
}

/**
 * Applies the posting rules for one stored event (the process-provider-event job). Safe to run any
 * number of times: the event row is locked, processed_at is checked, the donation row is locked and
 * its status checked, and every journal entry has an idempotency key.
 */
export async function processProviderEvent(stripeEventId: string): Promise<ProcessResult> {
  const [peek] = await sql`select type, payload, processed_at from provider_events where stripe_event_id = ${stripeEventId}`;
  if (!peek) throw new Error(`unknown provider event ${stripeEventId}`);
  if (peek.processed_at) return { outcome: "already_processed" };
  const event = peek.payload as Stripe.Event;

  // Stripe is read before the transaction (network calls don't hold row locks); reads are idempotent.
  // The fee (balance transaction) is attached to the charge a moment after the payment succeeds, so it
  // may be missing here; the gift is booked anyway and the fee follows with charge.updated.
  let facts: ChargeFacts | null = null;
  const piId = paymentIntentOf(event);
  const wantsFacts = event.type === "payment_intent.succeeded" ||
    (event.type === "charge.updated" && Boolean((event.data.object as Stripe.Charge).balance_transaction));
  if (piId && wantsFacts) {
    facts = await stripeGateway().chargeFacts(piId, event.account ? connectedAccount(event.account) : undefined);
  }

  try {
    return await sql.begin(async (tx) => {
      const [ev] = await tx`select id, processed_at from provider_events where stripe_event_id = ${stripeEventId} for update`;
      if (ev.processed_at) return { outcome: "already_processed" } as const;
      const done = async (entryId: string | null = null) => {
        await tx`update provider_events set processed_at = now(), error = null, matched_entry_id = coalesce(${entryId}, matched_entry_id)
          where id = ${ev.id}`;
      };

      const pi = event.data.object as Stripe.PaymentIntent;
      switch (event.type) {
        case "payment_intent.processing":
        case "payment_intent.payment_failed": {
          const next = event.type === "payment_intent.processing" ? "processing" : "failed";
          const from = next === "processing" ? ["pending"] : ["pending", "processing"];
          const [d] = await tx`update donations set status = ${next}
            where stripe_payment_intent_id = ${pi.id} and status = any(${from}) returning id`;
          await done();
          return { outcome: "status", donationId: d?.id ?? null, status: next } as const;
        }

        case "payment_intent.succeeded": {
          const [d] = await tx`
            select d.id, d.org_id, d.amount_cents, d.qualified_25f, d.state, d.tax_year, d.status, d.confirmation_no, o.timezone
            from donations d join orgs o on o.id = d.org_id
            where d.stripe_payment_intent_id = ${pi.id} for update of d`;
          if (!d) throw new Error(`no donation for PaymentIntent ${pi.id}`);
          if (BigInt(pi.amount_received ?? pi.amount) !== BigInt(d.amount_cents)) {
            throw new Error(`amount mismatch on ${pi.id}: Stripe ${pi.amount_received}, donation ${d.amount_cents}`);
          }
          if (!["pending", "processing"].includes(d.status)) {
            // a different event already booked this gift; never book it twice
            await done();
            return { outcome: "no_change", donationId: d.id } as const;
          }
          const occurredAt = new Date(event.created * 1000);
          const [{ no }] = await tx`select next_number(${d.org_id}, 'R', ${d.tax_year}::smallint) as no`;
          await tx`update donations set status = 'succeeded', succeeded_at = ${occurredAt}, received_on = ${orgDate(occurredAt, d.timezone)},
              confirmation_no = ${no}, stripe_charge_id = coalesce(stripe_charge_id, ${facts?.chargeId ?? null})
            where id = ${d.id}`;
          await tx`insert into receipts (donation_id) values (${d.id}) on conflict (donation_id) do nothing`;

          const g = { id: d.id, orgId: d.org_id, amountCents: BigInt(d.amount_cents), qualified25f: d.qualified_25f, state: d.state, confirmationNo: no };
          const gift = await postGiftSucceeded(tx, g, event.id, occurredAt);
          await tx`insert into audit_events (org_id, action, subject_type, subject_id, detail)
            values (${d.org_id}, 'donation.succeeded', 'donation', ${d.id},
              ${tx.json({ confirmation_no: no, stripe_event_id: event.id })})`;
          if (facts) {
            await bookFee(tx, { ...(d as GiftRow), confirmation_no: no, fee_cents: "0", succeeded_at: occurredAt }, facts, occurredAt);
          }
          await done(gift.entryId);
          return { outcome: "booked", donationId: d.id, entryId: gift.entryId, sendReceipt: true } as const;
        }

        case "charge.updated": {
          // only interesting once the fee is attached, and only for charges that belong to a gift
          if (!facts || !piId) { await done(); return { outcome: "ignored", type: event.type } as const; }
          const [d] = await tx<GiftRow[]>`
            select id, org_id, amount_cents, fee_cents, qualified_25f, state, confirmation_no, succeeded_at
            from donations where stripe_payment_intent_id = ${piId} for update`;
          if (!d) { await done(); return { outcome: "ignored", type: event.type } as const; }
          // not booked yet: payment_intent.succeeded reads the fee itself when it books the gift
          if (!d.confirmation_no || BigInt(d.fee_cents) !== 0n) { await done(); return { outcome: "no_change", donationId: d.id } as const; }
          const fee = await bookFee(tx, d, facts, d.succeeded_at ?? new Date(event.created * 1000));
          await done(fee?.entryId ?? null);
          return { outcome: "fee", donationId: d.id, entryId: fee?.entryId ?? null } as const;
        }

        default:
          await done();
          return { outcome: "ignored", type: event.type } as const;
      }
    });
  } catch (e) {
    await sql`update provider_events set error = ${String((e as Error).message).slice(0, 1000)} where stripe_event_id = ${stripeEventId}`;
    throw e;
  }
}
