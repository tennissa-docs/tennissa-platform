import "server-only";
import { Inngest } from "inngest";
import { isProduction } from "@/lib/env";

// One Inngest app for the platform. Locally, INNGEST_DEV=1 points it at the Inngest dev server
// (`npm run inngest`). In production it needs INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.
// Dev mode turns off signature checks on /api/inngest, so production refuses it.
if (isProduction && process.env.INNGEST_DEV) {
  throw new Error("INNGEST_DEV must not be set in production (it disables Inngest's request signatures)");
}

// Checkpointing (v4 default) is a latency optimisation that reports steps back to Inngest as they run;
// these jobs are short, and with it off each step is its own request: simpler to reason about and test.
export const inngest = new Inngest({ id: "tennissa-platform", checkpointing: false });

/** Event names. Payloads carry ids only; every job re-reads the database. */
export const EVENTS = {
  /** a Stripe webhook event was stored in provider_events */
  providerEventStored: "stripe/event.stored",
  /** a gift was booked (confirmation number and receipt row exist) */
  giftBooked: "donation/booked",
} as const;
