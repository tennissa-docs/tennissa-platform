import "server-only";
import type { Tx } from "@/lib/db";
import { giftAccounts } from "./accounts";

// The only module that writes journal_entries and postings. One exported function per money event
// (architecture.md › Posting rules), each with its idempotency key. Feature code calls these; never
// insert into postings anywhere else. The database checks every entry balances at commit.

type Line = { account: string; debit?: bigint; credit?: bigint };
type SourceType = "donation" | "donation_fee";

type Entry = {
  orgId: string;
  occurredAt: Date;
  memo: string;
  sourceType: SourceType;
  sourceId: string;
  idempotencyKey: string;
  lines: Line[];
  createdBy?: string | null;
};

export type Posted = { entryId: string; created: boolean };

async function postEntry(tx: Tx, e: Entry): Promise<Posted> {
  const debits = e.lines.reduce((s, l) => s + (l.debit ?? 0n), 0n);
  const credits = e.lines.reduce((s, l) => s + (l.credit ?? 0n), 0n);
  if (debits !== credits || e.lines.length < 2) throw new Error(`unbalanced entry ${e.idempotencyKey}`);

  const inserted = await tx`
    insert into journal_entries (org_id, occurred_at, memo, source_type, source_id, idempotency_key, created_by)
    values (${e.orgId}, ${e.occurredAt}, ${e.memo}, ${e.sourceType}, ${e.sourceId}, ${e.idempotencyKey}, ${e.createdBy ?? null})
    on conflict (idempotency_key) do nothing
    returning id`;
  if (inserted.length === 0) {
    const [existing] = await tx`select id from journal_entries where idempotency_key = ${e.idempotencyKey}`;
    return { entryId: existing.id, created: false };
  }
  const entryId: string = inserted[0].id;
  for (const l of e.lines) {
    await tx`insert into postings (entry_id, account_key, debit_cents, credit_cents)
      values (${entryId}, ${l.account}, ${(l.debit ?? 0n).toString()}, ${(l.credit ?? 0n).toString()})`;
  }
  return { entryId, created: true };
}

export type GiftForPosting = {
  id: string;
  orgId: string;
  amountCents: bigint;
  qualified25f: boolean;
  state: string | null;
  confirmationNo: string;
};

/** Gift succeeds (Stripe): Dr Stripe balance (gross), Cr contributions. Key `<event_id>:gift`. */
export function postGiftSucceeded(tx: Tx, g: GiftForPosting, eventId: string, occurredAt: Date): Promise<Posted> {
  const a = giftAccounts(g.qualified25f, g.state);
  return postEntry(tx, {
    orgId: g.orgId, occurredAt, sourceType: "donation", sourceId: g.id,
    memo: `Gift ${g.confirmationNo}`, idempotencyKey: `${eventId}:gift`,
    lines: [{ account: a.stripe, debit: g.amountCents }, { account: a.income, credit: g.amountCents }],
  });
}

/** Its Stripe fee, from the balance transaction (never computed): Dr fees, Cr Stripe balance. Key `<event_id>:fee`. */
export function postGiftFee(tx: Tx, g: GiftForPosting, feeCents: bigint, eventId: string, occurredAt: Date): Promise<Posted | null> {
  if (feeCents <= 0n) return Promise.resolve(null);
  const a = giftAccounts(g.qualified25f, g.state);
  return postEntry(tx, {
    orgId: g.orgId, occurredAt, sourceType: "donation_fee", sourceId: g.id,
    memo: `Processing fee on ${g.confirmationNo}`, idempotencyKey: `${eventId}:fee`,
    lines: [{ account: "expense:fees:processing", debit: feeCents }, { account: a.stripe, credit: feeCents }],
  });
}
