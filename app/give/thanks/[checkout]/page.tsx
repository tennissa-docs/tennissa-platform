import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Banner, Card, KeyValueList } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { sql } from "@/lib/db";
import { formatDate } from "@/lib/clock";
import { formatMoney } from "@/lib/money";
import { checkSignedValue } from "@/lib/auth/token";
import { connectedAccount, isStripeConfigured, stripeGateway } from "@/lib/stripe";
import { METHOD_LABEL } from "@/lib/give/send-receipt";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// S07: the thank-you page. Public, but only with the signed link from the give flow or the receipt email.
export default async function ThanksPage({ params, searchParams }: {
  params: Promise<{ checkout: string }>; searchParams: Promise<{ t?: string }>;
}) {
  const { checkout } = await params;
  const { t } = await searchParams;
  if (!UUID.test(checkout) || !(await checkSignedValue(`thanks:${checkout}`, t))) notFound();

  const [d] = await sql`
    select d.amount_cents, d.method, d.status, d.confirmation_no, d.qualified_25f, d.state, d.tax_year, d.created_at, d.succeeded_at,
           d.stripe_payment_intent_id, p.stripe_account_id, dn.first_name, dn.last_name, dn.email, s.name as school_name, o.timezone
    from donations d join donors dn on dn.id = d.donor_id join orgs o on o.id = d.org_id
    left join processor_accounts p on p.id = d.processor_account_id
    left join schools s on s.id = d.designation_school_id
    where d.checkout_id = ${checkout}`;
  if (!d) notFound();

  // Display only: if our webhook hasn't arrived yet, ask Stripe where the payment is. The books change
  // only when the webhook is processed.
  let status: string = d.status;
  if (status === "pending" && d.stripe_payment_intent_id && isStripeConfigured()) {
    try {
      const pi = await stripeGateway().retrievePaymentIntent(d.stripe_payment_intent_id, connectedAccount(d.stripe_account_id));
      if (pi.status === "processing") status = "processing";
      else if (pi.status === "succeeded") status = "confirming";
    } catch { /* show what we have */ }
  }

  const amount = formatMoney(d.amount_cents);
  const items: [string, string][] = [
    ["Donor", `${d.first_name} ${d.last_name}`],
    ["Amount", amount],
    ["Paid by", METHOD_LABEL[d.method] ?? d.method],
    ["Goes to", d.school_name ?? "Wherever the need is greatest"],
    ["Tax credit", d.qualified_25f ? `Qualified contribution (${d.state}), tax year ${d.tax_year}` : "Regular gift, not for the tax credit"],
    ["Date", formatDate(d.succeeded_at ?? d.created_at, d.timezone)],
  ];

  return (
    <PublicShell cta="none">
      <div className="mx-auto max-w-[var(--layout-form-max)] px-[var(--layout-gutter)] py-12 md:py-20">
        {status === "succeeded" && (
          <div className="text-center">
            <CheckCircle2 aria-hidden className="mx-auto size-10 text-success" />
            <h1 className="text-headline mt-4">Thank you, {d.first_name}</h1>
            <p className="text-text-muted mt-2">Your gift of {amount} has cleared. Your receipt is on its way to {d.email}.</p>
            <p className="mt-8 text-caption text-text-muted">Confirmation number</p>
            <p className="text-display tabular mt-1 break-all">{d.confirmation_no}</p>
          </div>
        )}
        {(status === "processing" || status === "confirming" || status === "pending") && (
          <div className="text-center">
            <Clock aria-hidden className="mx-auto size-10 text-accent" />
            <h1 className="text-headline mt-4">Thank you, {d.first_name}</h1>
            {status === "processing" ? (
              <p className="text-text-muted mt-2">
                Your bank payment of {amount} is on its way. Bank payments usually take about four business days to clear.
                We&apos;ll email your receipt and confirmation number to {d.email} as soon as it does.
              </p>
            ) : (
              <p className="text-text-muted mt-2" role="status">Confirming your payment of {amount}. This page updates by itself.</p>
            )}
            {status !== "processing" && <AutoRefresh />}
          </div>
        )}
        {(status === "failed" || status === "returned" || status === "disputed") && (
          <div className="text-center">
            <XCircle aria-hidden className="mx-auto size-10 text-danger" />
            <h1 className="text-headline mt-4">The payment didn&apos;t go through</h1>
            <p className="text-text-muted mt-2">Nothing was charged. You can try again with another card or bank account.</p>
            <div className="mt-6"><ButtonLink href="/donate/give">Try again</ButtonLink></div>
          </div>
        )}
        {(status === "refunded" || status === "partly_refunded") && (
          <div className="mb-6"><Banner tone="info">Part or all of this gift was refunded. Your refund receipt was emailed to you.</Banner></div>
        )}

        <Card className="mt-10">
          <KeyValueList items={items} />
        </Card>
        <p className="mt-6 text-center text-caption text-text-muted">
          TENNISSA did not provide any goods or services in exchange for this gift. Keep your receipt email for your records.
        </p>
      </div>
    </PublicShell>
  );
}
