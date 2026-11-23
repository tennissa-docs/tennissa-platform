import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { storeProviderEvent } from "@/lib/give/process-event";
import { EVENTS, inngest } from "@/lib/inngest/client";

// Stripe webhooks (platform and Connect). Every event is stored first (unique stripe_event_id), then
// handed to the process-provider-event job, which books it and queues the receipt. A replayed event
// is stored once and books nothing new. Non-2xx makes Stripe retry; the retry-stuck job also picks
// up any stored event that never got processed.
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const raw = await req.text();
  if (!signature || env.stripeWebhookSecrets.length === 0) {
    return NextResponse.json({ error: "missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event | null = null;
  for (const secret of env.stripeWebhookSecrets) {
    try {
      event = stripe().webhooks.constructEvent(raw, signature, secret);
      break;
    } catch { /* try the next secret */ }
  }
  if (!event) return NextResponse.json({ error: "bad signature" }, { status: 400 });

  try {
    const { stored } = await storeProviderEvent(event);
    // the event id makes Inngest drop a duplicate send for 24 hours; the job is idempotent beyond that
    await inngest.send({ name: EVENTS.providerEventStored, id: `stripe:${event.id}`, data: { stripeEventId: event.id } });
    return NextResponse.json({ received: true, queued: true, replay: !stored });
  } catch (e) {
    console.error(`queueing ${event.id} failed`, e);
    return NextResponse.json({ error: "not queued; will retry" }, { status: 500 });
  }
}
