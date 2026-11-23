"use client";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckboxField, RadioCard, SelectField, TextField } from "@/components/ui/form";
import { Banner } from "@/components/ui/display";
import { formatMoney, parseDollars } from "@/lib/money";
import { US_STATES } from "@/lib/give/schema";
import tokens from "@/replica/design/tokens.json";

type Filing = "single" | "married_joint" | "married_separate";
type Form = {
  filingStatus: Filing | "";
  amount: string;
  firstName: string; lastName: string; email: string;
  line1: string; line2: string; city: string; state: string; zip: string;
  method: "ach" | "card";
  forTaxCredit: boolean; attestUsPerson: boolean; attestOwnMoney: boolean; consentEmailStatements: boolean;
};
type Errors = Partial<Record<string, string>>;
type Intent = { checkoutId: string; clientSecret: string; stripeAccount?: string; thanksPath: string };

const STEPS = ["How you file", "Your gift", "About you", "Where it goes", "Payment"] as const;
const CAP = 170_000n;

const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripe(pk: string, account?: string) {
  const k = `${pk}:${account ?? ""}`;
  if (!stripeCache.has(k)) stripeCache.set(k, loadStripe(pk, account ? { stripeAccount: account } : undefined));
  return stripeCache.get(k)!;
}

export function GiveFlow({ publishableKey }: { publishableKey: string }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>({
    filingStatus: "", amount: "", firstName: "", lastName: "", email: "",
    line1: "", line2: "", city: "", state: "TN", zip: "",
    method: "ach", forTaxCredit: true, attestUsPerson: false, attestOwnMoney: false, consentEmailStatements: true,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const checkoutId = useRef<string>(crypto.randomUUID());
  const headingRef = useRef<HTMLHeadingElement>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const cents = parseDollars(f.amount);

  function go(n: number) {
    setStep(n);
    setFormError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function validate(s: number): Errors {
    const e: Errors = {};
    if (s === 0 && !f.filingStatus) e.filingStatus = "Choose how you file your taxes.";
    if (s === 1) {
      if (cents === null) e.amount = "Enter an amount, like 250 or 1,700.";
      else if (cents < 100n) e.amount = "The smallest gift is $1.00.";
      else if (f.forTaxCredit && cents > CAP) e.amount = `The credit covers up to ${formatMoney(CAP)} per person. Lower the amount, or make a regular gift in the last step.`;
    }
    if (s === 2) {
      if (!f.firstName.trim()) e.firstName = "Enter your first name.";
      if (!f.lastName.trim()) e.lastName = "Enter your last name.";
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter an email address we can send your receipt to.";
      if (!f.line1.trim()) e.line1 = "Enter your street address.";
      if (!f.city.trim()) e.city = "Enter your city.";
      if (!/^\d{5}(-\d{4})?$/.test(f.zip.trim())) e.zip = "Enter a 5-digit ZIP code.";
    }
    if (s === 3 && f.forTaxCredit) {
      if (!f.attestUsPerson) e.attestUsPerson = "Confirm this to claim the credit, or untick the credit box.";
      if (!f.attestOwnMoney) e.attestOwnMoney = "Confirm this to claim the credit, or untick the credit box.";
      if (cents !== null && cents > CAP) e.forTaxCredit = `A tax-credit gift can be up to ${formatMoney(CAP)}. Untick this for a regular gift, or go back and lower the amount.`;
    }
    return e;
  }

  async function next(ev: FormEvent) {
    ev.preventDefault();
    const e = validate(step);
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      setFormError("Check the highlighted fields.");
      return;
    }
    if (step < 3) return go(step + 1);
    await createIntent();
  }

  async function createIntent() {
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/give/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkoutId: checkoutId.current, filingStatus: f.filingStatus, amountCents: Number(cents),
          firstName: f.firstName, lastName: f.lastName, email: f.email.trim(),
          address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, zip: f.zip.trim() },
          method: f.method, forTaxCredit: f.forTaxCredit,
          attestUsPerson: f.forTaxCredit && f.attestUsPerson, attestOwnMoney: f.forTaxCredit && f.attestOwnMoney,
          consentEmailStatements: f.consentEmailStatements,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const fe: Errors = {};
        for (const [k, v] of Object.entries((body.fields ?? {}) as Record<string, string>)) fe[k.replace(/^address\./, "").replace(/^amountCents$/, "amount")] = v;
        setErrors(fe);
        setFormError(body.error ?? "Something went wrong. Nothing was charged.");
        if (fe.amount) go(1);
        else if (fe.firstName || fe.lastName || fe.email || fe.line1 || fe.city || fe.zip || fe.state) go(2);
        return;
      }
      setIntent(body as Intent);
      go(4);
    } catch {
      setFormError("We couldn't reach TENNISSA. Check your connection and try again. Nothing was charged.");
    } finally {
      setBusy(false);
    }
  }

  function back() {
    if (step === 4) {
      // changing anything starts a new checkout; the unconfirmed one is never charged
      setIntent(null);
      checkoutId.current = crypto.randomUUID();
    }
    go(step - 1);
  }

  const amountLabel = cents !== null && cents > 0n ? formatMoney(cents) : "";

  return (
    <div>
      <div className="mb-8">
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-pill ${i <= step ? "bg-accent" : "bg-surface-sunken"}`} />
          ))}
        </div>
        <p className="mt-3 text-caption text-text-muted">Step {step + 1} of {STEPS.length}</p>
      </div>

      {formError && <div className="mb-6"><Banner tone="danger" role="alert">{formError}</Banner></div>}

      {step < 4 ? (
        <form onSubmit={next} noValidate className="flex flex-col gap-5">
          {step === 0 && (
            <fieldset className="flex flex-col gap-3">
              <legend><h1 ref={headingRef} tabIndex={-1} className="text-title mb-2 outline-none">How do you file your taxes?</h1></legend>
              <p className="text-sm text-text-muted -mt-1 mb-2">The tax credit is up to $1,700 per person each year.</p>
              <RadioCard name="filing" value="single" checked={f.filingStatus === "single"} onChange={() => set("filingStatus", "single")}
                title="Single or head of household" />
              <RadioCard name="filing" value="married_joint" checked={f.filingStatus === "married_joint"} onChange={() => set("filingStatus", "married_joint")}
                title="Married filing jointly" description="Each spouse can give up to $1,700. For now, each spouse gives separately, in their own name." />
              <RadioCard name="filing" value="married_separate" checked={f.filingStatus === "married_separate"} onChange={() => set("filingStatus", "married_separate")}
                title="Married filing separately" />
              {errors.filingStatus && <p role="alert" className="text-caption text-danger">{errors.filingStatus}</p>}
            </fieldset>
          )}

          {step === 1 && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className="text-title outline-none">How much would you like to give?</h1>
              <TextField label="Amount" prefix="$" inputMode="decimal" autoComplete="off" value={f.amount}
                hint="Up to $1,700 counts toward the tax credit." error={errors.amount}
                onChange={(e) => set("amount", e.target.value)}
                onBlur={() => { const c = parseDollars(f.amount); if (c !== null) set("amount", formatMoney(c).slice(1)); }} />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested amounts">
                {[25_000n, 50_000n, 170_000n].map((c) => (
                  <Button key={String(c)} type="button" variant="secondary" size="sm" onClick={() => set("amount", formatMoney(c).slice(1))}>
                    {formatMoney(c, { showCents: false })}
                  </Button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className="text-title outline-none">About you</h1>
              <p className="text-sm text-text-muted -mt-3">Your receipt and year-end statement need your legal name and mailing address.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="First name" autoComplete="given-name" value={f.firstName} error={errors.firstName} onChange={(e) => set("firstName", e.target.value)} />
                <TextField label="Last name" autoComplete="family-name" value={f.lastName} error={errors.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
              <TextField label="Email" type="email" autoComplete="email" hint="Your receipt goes here." value={f.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
              <TextField label="Street address" autoComplete="address-line1" value={f.line1} error={errors.line1} onChange={(e) => set("line1", e.target.value)} />
              <TextField label="Apartment, suite (optional)" autoComplete="address-line2" value={f.line2} onChange={(e) => set("line2", e.target.value)} />
              <div className="grid gap-5 sm:grid-cols-[1fr_120px_140px]">
                <TextField label="City" autoComplete="address-level2" value={f.city} error={errors.city} onChange={(e) => set("city", e.target.value)} />
                <SelectField label="State" autoComplete="address-level1" value={f.state} error={errors.state} onChange={(e) => set("state", e.target.value)}>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </SelectField>
                <TextField label="ZIP code" inputMode="numeric" autoComplete="postal-code" value={f.zip} error={errors.zip} onChange={(e) => set("zip", e.target.value)} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className="text-title outline-none">Where your gift goes</h1>
              <div className="rounded-lg bg-surface px-4 py-3">
                <p className="text-sm font-semibold">Wherever the need is greatest</p>
                <p className="text-caption text-text-muted mt-0.5">TENNISSA awards it to eligible students at partner schools. Gifts can&apos;t name a student.</p>
              </div>

              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold mb-2">How will you pay?</legend>
                <RadioCard name="method" value="ach" checked={f.method === "ach"} onChange={() => set("method", "ach")}
                  title="Bank account" description="Takes a few business days to clear." detail="Lower fee" />
                <RadioCard name="method" value="card" checked={f.method === "card"} onChange={() => set("method", "card")}
                  title="Card" description="Clears right away." />
              </fieldset>

              <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-semibold">The tax credit</legend>
                <CheckboxField checked={f.forTaxCredit} onChange={(v) => set("forTaxCredit", v)} error={errors.forTaxCredit}>
                  Count this gift toward my federal scholarship tax credit
                </CheckboxField>
                {f.forTaxCredit && (
                  <div className="flex flex-col gap-4 pl-8">
                    <CheckboxField checked={f.attestUsPerson} onChange={(v) => set("attestUsPerson", v)} error={errors.attestUsPerson}>
                      I&apos;m a U.S. citizen or resident
                    </CheckboxField>
                    <CheckboxField checked={f.attestOwnMoney} onChange={(v) => set("attestOwnMoney", v)} error={errors.attestOwnMoney}>
                      This is my own money, not a business&apos;s
                    </CheckboxField>
                  </div>
                )}
                <p className="text-caption text-text-muted">This choice is recorded with your gift and can&apos;t be changed afterwards.</p>
              </fieldset>

              <CheckboxField checked={f.consentEmailStatements} onChange={(v) => set("consentEmailStatements", v)}>
                Email my year-end statement to me
              </CheckboxField>
            </>
          )}

          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {step > 0 ? (
              <Button type="button" variant="ghost" icon={<ArrowLeft aria-hidden className="size-4" />} onClick={back}>Back</Button>
            ) : <span />}
            <Button type="submit" size="lg" loading={busy}>
              {step === 3 ? "Continue to payment" : "Continue"}
            </Button>
          </div>
        </form>
      ) : (
        intent && (
          <>
            <h1 ref={headingRef} tabIndex={-1} className="text-title outline-none mb-2">Payment</h1>
            <p className="text-sm text-text-muted mb-6">
              {amountLabel} from {f.firstName} {f.lastName}
              {f.forTaxCredit ? ", toward the tax credit" : ", a regular gift"}.
            </p>
            <Elements stripe={getStripe(publishableKey, intent.stripeAccount)} options={{
              clientSecret: intent.clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: tokens.color.accent, colorText: tokens.color.text, colorDanger: tokens.color.danger,
                  colorBackground: tokens.color.bg, borderRadius: tokens.radius.md + "px",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                },
              },
            }}>
              <PayStep intent={intent} amountLabel={amountLabel} name={`${f.firstName} ${f.lastName}`} email={f.email.trim()} onBack={back} />
            </Elements>
          </>
        )
      )}
    </div>
  );
}

function PayStep({ intent, amountLabel, name, email, onBack }: {
  intent: Intent; amountLabel: string; name: string; email: string; onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnUrl = useMemo(() => new URL(intent.thanksPath, window.location.origin).toString(), [intent.thanksPath]);

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl, payment_method_data: { billing_details: { name, email } } },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message ?? "The payment didn't go through. Nothing was charged.");
      setBusy(false);
      return;
    }
    router.push(intent.thanksPath);
  }

  return (
    <form onSubmit={pay} className="flex flex-col gap-6">
      {/* Link is off: it offers its own bank and pay-later options, but a gift is paid only by the method the donor chose */}
      <PaymentElement options={{
        defaultValues: { billingDetails: { name, email } },
        fields: { billingDetails: { name: "never", email: "never" } },
        wallets: { link: "never" },
      }} />
      {error && <Banner tone="danger" role="alert">{error}</Banner>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" icon={<ArrowLeft aria-hidden className="size-4" />} onClick={onBack} disabled={busy}>Back</Button>
        <Button type="submit" size="lg" loading={busy} disabled={!stripe}>Give {amountLabel}</Button>
      </div>
      <p className="flex items-start gap-2 text-caption text-text-muted">
        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Your payment details go straight to Stripe, our payment processor; TENNISSA never sees your card or bank numbers.
        Your gift is charged once, now. It is recorded permanently with its receipt.
      </p>
    </form>
  );
}
