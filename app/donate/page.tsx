import type { Metadata } from "next";
import { CalendarClock, HandCoins, Receipt, School } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { ButtonLink } from "@/components/ui/button";
import { now } from "@/lib/clock";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Give" };

// S05: the public giving page (plain, fund-wide).
export default function DonatePage() {
  const open = now() >= env.givingOpensAt;
  const steps = [
    { icon: HandCoins, title: "Give once, today", body: "Pick an amount and pay by bank account or card. Your gift is charged right away." },
    { icon: Receipt, title: "Get your receipt", body: "We email a receipt with its confirmation number as soon as the payment clears." },
    { icon: School, title: "A student gets a scholarship", body: "Gifts fund tuition at Tennessee Islamic schools for families who qualify." },
  ];
  return (
    <PublicShell cta={open ? "give" : "none"}>
      <section className="mx-auto max-w-[var(--layout-reading-max)] px-[var(--layout-gutter)] py-20 text-center md:py-28">
        <h1 className="text-display md:text-hero text-balance">Give up to $1,700. Get it back as a tax credit.</h1>
        <p className="mx-auto mt-6 max-w-xl text-lg font-normal text-text-muted text-pretty">
          Your gift to TENNISSA can count toward the federal scholarship tax credit, dollar for dollar, and helps a
          Tennessee family afford an Islamic school education.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          {open ? (
            <ButtonLink href="/donate/give" size="lg">Give now</ButtonLink>
          ) : (
            <>
              <span className="inline-flex h-12 items-center gap-2 rounded-pill bg-surface px-7 font-semibold text-text-muted">
                <CalendarClock aria-hidden className="size-5" /> Giving opens January 1, 2027
              </span>
              <p className="text-sm text-text-muted">We&apos;re finishing setup so every gift is receipted and reported correctly.</p>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="how" className="bg-surface">
        <div className="mx-auto max-w-[var(--layout-content-max)] px-[var(--layout-gutter)] py-16">
          <h2 id="how" className="text-title text-center">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl bg-surface-raised border border-border p-6">
                <s.icon aria-hidden className="size-6 text-text-muted" />
                <p className="mt-4 text-caption text-text-subtle">Step {i + 1}</p>
                <h3 className="text-lg mt-1">{s.title}</h3>
                <p className="mt-2 text-sm text-text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-10 max-w-2xl text-center text-caption text-text-muted">
            The credit is up to $1,700 per taxpayer per year. Whether you can claim it depends on your own tax situation;
            ask your tax advisor. Gifts can&apos;t be directed to a particular student.
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
