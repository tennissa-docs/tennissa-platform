import "server-only";
import { sql } from "@/lib/db";
import type { Ctx } from "@/lib/auth";

export const STATUSES = ["pending", "processing", "succeeded", "failed", "partly_refunded", "refunded", "returned", "disputed"] as const;
export const METHODS = ["ach", "card", "check", "wire"] as const;

export type DonationFilters = { q?: string; status?: string; method?: string; from?: string; to?: string; page?: number };
export const PAGE_SIZE = 50;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function cleanFilters(raw: Record<string, string | string[] | undefined>): DonationFilters {
  const one = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : undefined) || undefined;
  const status = one("status");
  const method = one("method");
  const from = one("from");
  const to = one("to");
  const page = Number(one("page") ?? 1);
  return {
    q: one("q")?.slice(0, 100),
    status: status && (STATUSES as readonly string[]).includes(status) ? status : undefined,
    method: method && (METHODS as readonly string[]).includes(method) ? method : undefined,
    from: from && DATE.test(from) ? from : undefined,
    to: to && DATE.test(to) ? to : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** S01: the donations list. Dates filter on the day the gift was made, in the org's time zone. */
export async function listDonations(ctx: Ctx, f: DonationFilters) {
  const like = f.q ? `%${f.q.replace(/[\\%_]/g, (m) => "\\" + m)}%` : null;
  const where = sql`
    d.org_id = ${ctx.orgId}
    ${like ? sql`and (dn.first_name || ' ' || dn.last_name ilike ${like} or dn.email ilike ${like} or d.confirmation_no ilike ${like})` : sql``}
    ${f.status ? sql`and d.status = ${f.status}` : sql``}
    ${f.method ? sql`and d.method = ${f.method}` : sql``}
    ${f.from ? sql`and (d.created_at at time zone o.timezone)::date >= ${f.from}::date` : sql``}
    ${f.to ? sql`and (d.created_at at time zone o.timezone)::date <= ${f.to}::date` : sql``}`;

  const [summary] = await sql`
    select count(*)::int as n,
           coalesce(sum(d.amount_cents) filter (where d.succeeded_at is not null), 0) as received_cents,
           coalesce(sum(d.fee_cents), 0) as fee_cents
    from donations d join donors dn on dn.id = d.donor_id join orgs o on o.id = d.org_id
    where ${where}`;

  const offset = ((f.page ?? 1) - 1) * PAGE_SIZE;
  const rows = await sql`
    select d.id, d.created_at, d.succeeded_at, d.amount_cents, d.fee_cents, d.method, d.status, d.confirmation_no,
           d.qualified_25f, d.state, dn.first_name, dn.last_name, dn.email, s.name as school_name, o.timezone
    from donations d join donors dn on dn.id = d.donor_id join orgs o on o.id = d.org_id
    left join schools s on s.id = d.designation_school_id
    where ${where}
    order by d.created_at desc, d.id
    limit ${PAGE_SIZE} offset ${offset}`;

  return {
    total: summary.n as number,
    receivedCents: BigInt(summary.received_cents),
    feeCents: BigInt(summary.fee_cents),
    rows: rows.map((r) => ({
      id: r.id as string,
      date: (r.succeeded_at ?? r.created_at) as Date,
      timezone: r.timezone as string,
      donor: `${r.first_name} ${r.last_name}`,
      email: r.email as string,
      designation: (r.school_name as string | null) ?? "Greatest need",
      qualified: r.qualified_25f as boolean,
      state: r.state as string | null,
      method: r.method as string,
      amount: BigInt(r.amount_cents),
      fee: BigInt(r.fee_cents),
      status: r.status as string,
      confirmationNo: r.confirmation_no as string | null,
    })),
  };
}
