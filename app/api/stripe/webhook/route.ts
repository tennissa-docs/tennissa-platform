import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { processProviderEvent, storeProviderEvent } from "@/lib/give/process-event";
import { sendReceipt } from "@/lib/give/send-receipt";

// Stripe webhooks (platform and Connect). Every event is stored first (unique stripe_event_id), then
// processed. A replayed event is stored once and books nothing new. Non-2xx makes Stripe retry.
// TODO: hand processing and the receipt to Inngest jobs (process-provider-event, send-receipt).
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

  await storeProviderEvent(event);
  try {
    const result = await processProviderEvent(event.id);
    if (result.outcome === "booked" && result.sendReceipt) {
      // the gift is booked either way; a failed email is retried by resending from the donation
      sendReceipt(result.donationId).catch((e) => console.error("receipt email failed", e));
    }
    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (e) {
    console.error(`processing ${event.id} failed`, e);
    return NextResponse.json({ error: "processing failed; will retry" }, { status: 500 });
  }
}
