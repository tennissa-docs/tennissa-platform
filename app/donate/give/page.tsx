import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Banner, EmptyState } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { now } from "@/lib/clock";
import { env } from "@/lib/env";
import { isStripeConfigured } from "@/lib/stripe";
import { GiveFlow } from "./give-flow";

export const metadata: Metadata = { title: "Give" };

// S06: the give flow, as a page (not a modal), one question at a time.
export default function GivePage() {
  const open = now() >= env.givingOpensAt;
  return (
    <PublicShell cta="none">
      <div className="mx-auto max-w-[var(--layout-form-max)] px-[var(--layout-gutter)] py-10 md:py-16">
        {!open ? (
          <EmptyState icon={CalendarClock} title="Giving opens January 1, 2027"
            action={<ButtonLink href="/donate" variant="secondary">Back to the giving page</ButtonLink>}>
            Come back in the new year to make a gift toward the 2027 tax credit.
          </EmptyState>
        ) : (
          <>
            {!isStripeConfigured() && (
              <div className="mb-6">
                <Banner tone="warning" role="status">
                  Payments aren&apos;t connected yet, so the last step won&apos;t work. Staff: add the Stripe test keys to .env.local.
                </Banner>
              </div>
            )}
            <GiveFlow publishableKey={env.stripePublishableKey} />
          </>
        )}
      </div>
    </PublicShell>
  );
}
