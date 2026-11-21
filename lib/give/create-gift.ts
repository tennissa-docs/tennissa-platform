import "server-only";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { now as clockNow, taxYearOf } from "@/lib/clock";
import { formatMoney } from "@/lib/money";
import { connectedAccount, stripeGateway } from "@/lib/stripe";
import { signValue } from "@/lib/auth/token";
import { DISCLOSURE_VERSION, type GiveInput } from "./schema";

export class GiveError extends Error {
  constructor(public code: "closed" | "cap" | "cap_missing" | "no_account" | "payment", message: string, public field?: string) {
    super(message);
  }
}

export type CreatedGift = { checkoutId: string; clientSecret: string; stripeAccount?: string; thanksPath: string };

const FIRST_TAX_CREDIT_YEAR = 2027;
// gifts not yet confirmed by the donor count against the cap for an hour, so two open tabs can't both use it
const PENDING_COUNTS_FOR = "1 hour";

/**
 * POST /api/give/intent: find or create the donor, check the $1,700 cap with the donor row locked,
 * write the donation (pending) and create one PaymentIntent, charged now. Idempotent per checkout id,
 * so a double-clicked Give button charges once.
 */
export async function createGift(input: GiveInput): Promise<CreatedGift> {
  const at = clockNow();
  if (at < env.givingOpensAt) throw new GiveError("closed", "Giving opens on January 1, 2027.");
  const taxYear = taxYearOf(at);
  const qualified = input.forTaxCredit && input.attestUsPerson && input.attestOwnMoney && taxYear >= FIRST_TAX_CREDIT_YEAR;
  const email = input.email.trim().toLowerCase();

  const gift = await sql.begin(async (tx) => {
    const [org] = await tx`select id, states from orgs order by created_at limit 1`;
    if (!org) throw new Error("the SGO is not set up (run npm run db:seed)");

    const [already] = await tx`
      select d.id, d.amount_cents, d.method, d.donor_id, p.stripe_account_id, dn.email
      from donations d join processor_accounts p on p.id = d.processor_account_id join donors dn on dn.id = d.donor_id
      where d.checkout_id = ${input.checkoutId}`;
    if (already) return { donationId: already.id as string, amountCents: already.amount_cents as bigint, method: already.method as "ach" | "card",
      stripeAccountId: already.stripe_account_id as string, email: already.email as string };

    // the one listing state for now (TN); multi-state SGOs will ask the donor which state
    const state: string | null = qualified ? org.states[0] : null;
    const [account] = await tx`
      select id, stripe_account_id, status from processor_accounts
      where org_id = ${org.id} and kind = ${qualified ? "segregated_25f" : "general"}
        and coalesce(state, '--') = coalesce(${state}::char(2), '--')`;
    if (!account || account.status !== "active") throw new GiveError("no_account", "Online giving isn't set up yet. Please try again soon.");

    // donor numbers are sequential per org; lock so two first-time donors can't take the same one
    await tx`select pg_advisory_xact_lock(hashtext('donors:' || ${org.id}::text))`;
    let [donor] = await tx`select id from donors where org_id = ${org.id} and email = ${email} order by created_at limit 1 for update`;
    if (!donor) {
      [donor] = await tx`
        insert into donors (org_id, first_name, last_name, email, address, filing_status, donor_number)
        values (${org.id}, ${input.firstName}, ${input.lastName}, ${email}, ${tx.json(input.address)}, ${input.filingStatus},
                (select coalesce(max(donor_number), 1000) + 1 from donors where org_id = ${org.id}))
        returning id`;
    }

    if (qualified) {
      const [cap] = await tx`select per_taxpayer_cents from credit_caps where tax_year = ${taxYear}`;
      if (!cap) throw new GiveError("cap_missing", `Tax-credit gifts for ${taxYear} aren't open yet.`);
      const [{ used }] = await tx`
        select coalesce(sum(amount_cents), 0)::bigint as used from donations
        where donor_id = ${donor.id} and tax_year = ${taxYear} and qualified_25f
          and status <> 'failed'
          and (status <> 'pending' or created_at > now() - ${PENDING_COUNTS_FOR}::interval)`;
      const left = BigInt(cap.per_taxpayer_cents) - BigInt(used);
      if (BigInt(input.amountCents) > left) {
        throw new GiveError("cap",
          left > 0n
            ? `You can give up to ${formatMoney(left)} more toward the ${taxYear} credit. Lower the amount, or untick the credit box to make a regular gift.`
            : `You've reached the ${formatMoney(BigInt(cap.per_taxpayer_cents))} credit limit for ${taxYear}. Untick the credit box to make a regular gift.`,
          "amount");
      }
    }

    const [d] = await tx`
      insert into donations (org_id, donor_id, checkout_id, processor_account_id, amount_cents, method, state, qualified_25f,
        tax_year, status, attest_us_person, attest_own_money, attest_count_toward_credit, attested_at, disclosure_version)
      values (${org.id}, ${donor.id}, ${input.checkoutId}, ${account.id}, ${input.amountCents}, ${input.method}, ${state}, ${qualified},
        ${taxYear}, 'pending', ${input.attestUsPerson}, ${input.attestOwnMoney}, ${input.forTaxCredit}, ${at}, ${DISCLOSURE_VERSION})
      returning id`;
    await tx`insert into audit_events (org_id, action, subject_type, subject_id, detail)
      values (${org.id}, 'donation.started', 'donation', ${d.id},
        ${tx.json({ amount_cents: input.amountCents, method: input.method, qualified_25f: qualified, tax_year: taxYear })})`;
    return { donationId: d.id as string, amountCents: BigInt(input.amountCents), method: input.method, stripeAccountId: account.stripe_account_id as string, email };
  });

  const account = connectedAccount(gift.stripeAccountId);
  let pi: { id: string; clientSecret: string };
  try {
    pi = await stripeGateway().createPaymentIntent({
      amountCents: gift.amountCents, method: gift.method, email: gift.email,
      description: `Gift to TENNISSA`,
      metadata: { donation_id: gift.donationId, checkout_id: input.checkoutId },
      idempotencyKey: `checkout:${input.checkoutId}:1`,
      account,
    });
  } catch (e) {
    console.error("PaymentIntent create failed", e);
    await sql`update donations set status = 'failed' where id = ${gift.donationId} and status = 'pending' and stripe_payment_intent_id is null`;
    throw new GiveError("payment", "We couldn't start the payment. Nothing was charged. Please try again.");
  }
  await sql`update donations set stripe_payment_intent_id = ${pi.id}
    where id = ${gift.donationId} and stripe_payment_intent_id is null`;

  const sig = await signValue(`thanks:${input.checkoutId}`);
  return { checkoutId: input.checkoutId, clientSecret: pi.clientSecret, stripeAccount: account, thanksPath: `/give/thanks/${input.checkoutId}?t=${sig}` };
}
