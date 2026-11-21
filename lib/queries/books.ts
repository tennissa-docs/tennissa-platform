import "server-only";
import { sql } from "@/lib/db";
import type { Ctx } from "@/lib/auth";

// Read-only queries for the admin home and the ledger. Every figure comes from the books or the
// permanent records; nothing here is typed in or stored as a balance.

export type Balance = { key: string; name: string; type: string; state: string | null; debits: bigint; credits: bigint; balance: bigint };

export async function accountBalances(ctx: Ctx): Promise<Balance[]> {
  const rows = await sql`
    select key, name, type, state, debits_cents, credits_cents, balance_cents
    from account_balances where org_id = ${ctx.orgId}
    order by array_position(array['asset','liability','net_assets','income','expense'], type), key`;
  return rows.map((r) => ({
    key: r.key, name: r.name, type: r.type, state: r.state,
    debits: BigInt(r.debits_cents), credits: BigInt(r.credits_cents), balance: BigInt(r.balance_cents),
  }));
}

export async function trialBalance(ctx: Ctx) {
  const [t] = await sql`select debits_cents, credits_cents, entries, postings from trial_balance where org_id = ${ctx.orgId}`;
  const debits = BigInt(t?.debits_cents ?? 0);
  const credits = BigInt(t?.credits_cents ?? 0);
  return { debits, credits, difference: debits - credits, entries: Number(t?.entries ?? 0), postings: Number(t?.postings ?? 0) };
}

export async function overviewTiles(ctx: Ctx, year: number) {
  const [received] = await sql`select coalesce(sum(received_cents),0) as cents, coalesce(sum(donations),0)::int as n
    from annual_donation_report where org_id = ${ctx.orgId} and year = ${year}`;
  const [awarded] = await sql`
    select coalesce(sum(a.amount_cents),0) as cents, count(*)::int as n
    from awards a join orgs o on o.id = a.org_id
    where a.org_id = ${ctx.orgId} and a.status <> 'cancelled'
      and extract(year from a.awarded_at at time zone o.timezone) = ${year}`;
  const [owed] = await sql`select coalesce(sum(balance_cents),0) as cents from account_balances
    where org_id = ${ctx.orgId} and key like 'liability:awards_payable:%'`;
  const [schools] = await sql`select count(*)::int as n from schools where org_id = ${ctx.orgId} and status = 'active'`;
  return {
    received: { cents: BigInt(received.cents), count: received.n as number },
    awarded: { cents: BigInt(awarded.cents), count: awarded.n as number },
    owed: { cents: BigInt(owed.cents), schools: schools.n as number },
  };
}

/** Years with any activity, plus the current one, newest first. */
export async function seasons(ctx: Ctx, current: number): Promise<number[]> {
  const rows = await sql`select distinct tax_year from donations where org_id = ${ctx.orgId}`;
  const ys = new Set<number>([current, ...rows.map((r) => Number(r.tax_year))]);
  return [...ys].filter((y) => y >= 2026).sort((a, b) => b - a);
}
