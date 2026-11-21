import "server-only";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/clock";
import { formatMoney } from "@/lib/money";
import { signValue } from "@/lib/auth/token";
import { sendEmail } from "@/lib/email/send";
import { receiptEmail } from "@/lib/email/templates";

export const METHOD_LABEL: Record<string, string> = { ach: "Bank account", card: "Card", check: "Check", wire: "Wire" };

/** The send-receipt job: email the receipt once the gift has cleared. Sends at most once (receipts.emailed_at). */
export async function sendReceipt(donationId: string): Promise<"sent" | "already_sent" | "not_ready"> {
  const [r] = await sql`
    select d.id, d.org_id, d.amount_cents, d.method, d.qualified_25f, d.state, d.tax_year, d.confirmation_no, d.succeeded_at,
           d.checkout_id, d.status, dn.first_name, dn.last_name, dn.email, dn.donor_number, dn.user_id, o.ein, o.timezone,
           s.name as school_name, rc.id as receipt_id, rc.emailed_at
    from donations d join donors dn on dn.id = d.donor_id join orgs o on o.id = d.org_id
    left join schools s on s.id = d.designation_school_id
    left join receipts rc on rc.donation_id = d.id
    where d.id = ${donationId}`;
  if (!r || !r.receipt_id || !r.confirmation_no) return "not_ready";
  if (r.emailed_at) return "already_sent";

  const sig = await signValue(`thanks:${r.checkout_id}`);
  const email = await receiptEmail({
    donorName: `${r.first_name} ${r.last_name}`,
    donorNumber: r.donor_number,
    amount: formatMoney(r.amount_cents),
    date: formatDate(r.succeeded_at, r.timezone),
    confirmationNo: r.confirmation_no,
    method: METHOD_LABEL[r.method] ?? r.method,
    designation: r.school_name ?? "Wherever the need is greatest",
    qualified25f: r.qualified_25f,
    state: r.state,
    taxYear: r.tax_year,
    ein: r.ein,
    thanksUrl: `${env.appUrl}/give/thanks/${r.checkout_id}?t=${sig}`,
  });
  // claim the send first so two runs can't both email; release the claim if sending fails
  const claimed = await sql`update receipts set emailed_at = now() where id = ${r.receipt_id} and emailed_at is null returning id`;
  if (claimed.length === 0) return "already_sent";
  try {
    await sendEmail({
      orgId: r.org_id, kind: "receipt", to: r.email, recipientUserId: r.user_id,
      subjectType: "donation", subjectId: r.id, ...email,
    });
  } catch (e) {
    await sql`update receipts set emailed_at = null where id = ${r.receipt_id}`;
    throw e;
  }
  return "sent";
}
