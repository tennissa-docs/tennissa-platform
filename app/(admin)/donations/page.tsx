import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, HandCoins, Search, SearchX } from "lucide-react";
import { Card, DonationStatus, EmptyState, PageHeader } from "@/components/ui/display";
import { buttonClass, ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/clock";
import { formatMoney } from "@/lib/money";
import { cleanFilters, listDonations, METHODS, PAGE_SIZE, STATUSES, type DonationFilters } from "@/lib/queries/donations";
import { METHOD_LABEL } from "@/lib/give/send-receipt";

export const metadata: Metadata = { title: "Donations" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", processing: "Processing", succeeded: "Succeeded", failed: "Failed",
  partly_refunded: "Partly refunded", refunded: "Refunded", returned: "Returned", disputed: "Disputed",
};
const control = "h-10 rounded-pill border border-border-strong bg-bg px-4 text-sm text-text hover:border-border-input focus:border-accent focus:outline-none focus:shadow-focus";

function qs(f: DonationFilters, page: number) {
  const p = new URLSearchParams();
  for (const k of ["q", "status", "method", "from", "to"] as const) if (f[k]) p.set(k, f[k]!);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// S01: every gift, filterable. Slice version: filters and the list. CSV export and "Record offline donation" (S02) come next.
export default async function DonationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireRole(["owner", "admin", "auditor"], "/donations");
  const f = cleanFilters(await searchParams);
  const data = await listDonations(ctx, f);
  const filtered = Boolean(f.q || f.status || f.method || f.from || f.to);
  const page = f.page ?? 1;
  const first = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, data.total);

  return (
    <>
      <PageHeader
        title="Donations"
        description={
          <span className="tabular">
            {data.total.toLocaleString("en-US")} {data.total === 1 ? "donation" : "donations"} · {formatMoney(data.receivedCents)} received · {formatMoney(data.feeCents)} in fees
            {filtered ? " (filtered)" : ""}
          </span>
        }
      />

      <form method="get" role="search" aria-label="Filter donations" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <label htmlFor="q" className="sr-only">Search donor, email or confirmation number</label>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input id="q" name="q" type="search" defaultValue={f.q} placeholder="Search donor, email or R-number" className={`${control} w-full pl-10`} />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">Status</label>
          <select id="status" name="status" defaultValue={f.status ?? ""} className={control}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="method" className="sr-only">Method</label>
          <select id="method" name="method" defaultValue={f.method ?? ""} className={control}>
            <option value="">Any method</option>
            {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="from" className="text-caption text-text-muted">From</label>
          <input id="from" name="from" type="date" defaultValue={f.from} className={control} />
          <label htmlFor="to" className="text-caption text-text-muted">to</label>
          <input id="to" name="to" type="date" defaultValue={f.to} className={control} />
        </div>
        <button type="submit" className={buttonClass("secondary", "md")}>Apply</button>
        {filtered && <Link href="/donations" className={buttonClass("ghost", "md")}>Clear</Link>}
      </form>

      <Card className="p-0 overflow-hidden">
        {data.rows.length === 0 ? (
          filtered ? (
            <EmptyState icon={SearchX} title="No donations match" action={<ButtonLink href="/donations" variant="secondary">Clear filters</ButtonLink>}>
              Try a different name, status or date range.
            </EmptyState>
          ) : (
            <EmptyState icon={HandCoins} title="No donations yet" action={<ButtonLink href="/donate" variant="secondary">Open the giving page</ButtonLink>}>
              Gifts appear here the moment a donor starts one, and are booked when the payment clears.
            </EmptyState>
          )
        ) : (
          <>
            {/* desktop table */}
            <table className="hidden w-full text-sm md:table">
              <caption className="sr-only">Donations, newest first</caption>
              <thead>
                <tr className="border-b border-border text-left text-caption font-semibold text-text-subtle">
                  <th scope="col" className="px-6 py-3 font-semibold">Date</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Donor</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Designation</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Method</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Fee</th>
                  <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface">
                    <td className="whitespace-nowrap px-6 py-3 tabular">
                      {formatDate(r.date, r.timezone)}
                      {r.confirmationNo && <div className="text-caption text-text-muted">{r.confirmationNo}</div>}
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <div className="truncate font-semibold" title={r.donor}>{r.donor}</div>
                      <div className="truncate text-caption text-text-muted" title={r.email}>{r.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      {r.designation}
                      <div className="text-caption text-text-muted">{r.qualified ? `Tax credit (${r.state})` : "Regular gift"}</div>
                    </td>
                    <td className="px-3 py-3">{METHOD_LABEL[r.method] ?? r.method}</td>
                    <td className="px-3 py-3 text-right tabular">{formatMoney(r.amount)}</td>
                    <td className="px-3 py-3 text-right tabular text-text-muted">{r.fee > 0n ? formatMoney(r.fee) : "—"}</td>
                    <td className="px-6 py-3"><DonationStatus status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {data.rows.map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.donor}</p>
                      <p className="truncate text-caption text-text-muted">{formatDate(r.date, r.timezone)} · {METHOD_LABEL[r.method]} · {r.designation}</p>
                    </div>
                    <p className="tabular font-semibold">{formatMoney(r.amount)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <DonationStatus status={r.status} />
                    {r.confirmationNo && <span className="text-caption text-text-muted">{r.confirmationNo}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {data.total > PAGE_SIZE && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-end gap-2 text-sm text-text-muted">
          <span className="tabular">{first}–{last} of {data.total.toLocaleString("en-US")}</span>
          {page > 1 ? (
            <Link href={`/donations${qs(f, page - 1)}`} aria-label="Previous page" className="flex size-9 items-center justify-center rounded-full hover:bg-bg"><ChevronLeft aria-hidden className="size-4" /></Link>
          ) : <span className="size-9" />}
          {last < data.total && (
            <Link href={`/donations${qs(f, page + 1)}`} aria-label="Next page" className="flex size-9 items-center justify-center rounded-full hover:bg-bg"><ChevronRight aria-hidden className="size-4" /></Link>
          )}
        </nav>
      )}
    </>
  );
}
