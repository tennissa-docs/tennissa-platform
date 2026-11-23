import "server-only";
import { sql } from "@/lib/db";
import { processProviderEvent } from "@/lib/give/process-event";
import { sendReceipt } from "@/lib/give/send-receipt";
import { EVENTS, inngest } from "./client";

// The jobs behind giving (architecture.md › Jobs). Each one calls code that is already safe to run
// any number of times (row locks, processed_at, idempotency keys, emailed_at), so Inngest's
// retries can never book or email twice.

/** process-provider-event: apply the posting rules to one stored Stripe event. */
export const processProviderEventJob = inngest.createFunction(
  {
    id: "process-provider-event",
    retries: 10,
    triggers: [{ event: EVENTS.providerEventStored }],
  },
  async ({ event, step }) => {
    const stripeEventId = String(event.data.stripeEventId);
    const result = await step.run("apply posting rules", () => processProviderEvent(stripeEventId));
    if (result.outcome === "booked" && result.sendReceipt) {
      await step.sendEvent("queue the receipt", {
        name: EVENTS.giftBooked,
        id: `receipt:${result.donationId}`,
        data: { donationId: result.donationId },
      });
    }
    return result;
  },
);

/** send-receipt: email the receipt once the gift is booked. A failed send is retried; it never sends twice. */
export const sendReceiptJob = inngest.createFunction(
  {
    id: "send-receipt",
    retries: 10,
    triggers: [{ event: EVENTS.giftBooked }],
  },
  async ({ event, step }) => {
    const donationId = String(event.data.donationId);
    return { outcome: await step.run("send the receipt email", () => sendReceipt(donationId)) };
  },
);

/**
 * Safety net, every 15 minutes: anything a job should have done but hasn't (Inngest unreachable when
 * the webhook arrived, or a job that ran out of retries) is queued again. Looks back 3 days for
 * events and 7 days for receipts; older leftovers are for a person (and the nightly reconcile) to look at.
 */
export const retryStuckJob = inngest.createFunction(
  {
    id: "retry-stuck-giving-work",
    triggers: [{ cron: "TZ=America/Chicago */15 * * * *" }],
  },
  async ({ step }) => {
    const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
    const events = await step.run("find unprocessed Stripe events", async () =>
      (await sql`select stripe_event_id from provider_events
        where processed_at is null and received_at < now() - interval '5 minutes' and received_at > now() - interval '3 days'
        order by received_at limit 200`).map((r) => r.stripe_event_id as string));
    const receipts = await step.run("find receipts not yet emailed", async () =>
      (await sql`select r.donation_id from receipts r
        where r.emailed_at is null and r.issued_at < now() - interval '15 minutes' and r.issued_at > now() - interval '7 days'
        order by r.issued_at limit 200`).map((r) => r.donation_id as string));

    const queued = [
      ...events.map((id) => ({ name: EVENTS.providerEventStored, id: `sweep:${bucket}:${id}`, data: { stripeEventId: id } })),
      ...receipts.map((id) => ({ name: EVENTS.giftBooked, id: `sweep:${bucket}:${id}`, data: { donationId: id } })),
    ];
    if (queued.length > 0) await step.sendEvent("queue them again", queued);
    return { events: events.length, receipts: receipts.length };
  },
);

export const functions = [processProviderEventJob, sendReceiptJob, retryStuckJob];
