import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { isClockShifted, now, formatDate } from "@/lib/clock";

export function PublicShell({ children, cta = "give" }: { children: ReactNode; cta?: "give" | "signin" | "none" }) {
  const shifted = isClockShifted();
  const stripeTest = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
  return (
    <div className="flex min-h-dvh flex-col">
      {(shifted || stripeTest) && (
        <div className="bg-warning-tint text-warning text-caption text-center px-4 py-1.5" role="note">
          Test mode{stripeTest ? ": no real money moves" : ""}
          {shifted ? `. The app's clock is set to ${formatDate(now())} for testing.` : "."}
        </div>
      )}
      <header className="sticky top-0 z-10 h-14 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[var(--layout-content-max)] items-center justify-between px-[var(--layout-gutter)]">
          <Logo variant="compact" href="/donate" className="h-8" />
          {cta === "give" && <ButtonLink href="/donate/give" size="sm">Give</ButtonLink>}
          {cta === "signin" && <ButtonLink href="/login" size="sm" variant="secondary">Sign in</ButtonLink>}
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[var(--layout-content-max)] flex-col gap-2 px-[var(--layout-gutter)] py-8 text-caption text-text-muted md:flex-row md:justify-between">
          <p>TENNISSA, the Tennessee Islamic School Scholarship Alliance. A scholarship granting organization.</p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/login" className="hover:text-text">Staff sign-in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
