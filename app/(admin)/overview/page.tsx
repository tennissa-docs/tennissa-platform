import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins, School, Trophy } from "lucide-react";
import { Card, KeyValueList, PageHeader, SectionTitle, StatTile } from "@/components/ui/display";
import { requireRole } from "@/lib/auth";
import { now, taxYearOf } from "@/lib/clock";
import { formatMoney } from "@/lib/money";
import { accountBalances, overviewTiles, seasons } from "@/lib/queries/books";

export const metadata: Metadata = { title: "Overview" };

const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// S31: the admin home. Slice version: tiles and Books balances. Setup checklist, attention banner,
// charts and next steps come with the must-haves.
export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireRole(["owner", "admin", "auditor"], "/overview");
  const current = taxYearOf(now());
  const years = await seasons(ctx, current);
  const asked = Number((await searchParams).year);
  const year = years.includes(asked) ? asked : current;
  const [tiles, balances] = await Promise.all([overviewTiles(ctx, year), accountBalances(ctx)]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Where the money is, from the books. Every figure is calculated from the ledger; nothing is typed in."
        actions={
          <nav aria-label="Tax year" className="flex rounded-pill bg-surface-sunken p-1">
            {years.map((y) => (
              <Link key={y} href={`/overview?year=${y}`} aria-current={y === year ? "page" : undefined}
                className={`rounded-pill px-4 py-1.5 text-sm font-semibold tabular ${y === year ? "bg-bg shadow-card text-text" : "text-text-muted hover:text-text"}`}>
                {y}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <StatTile label="Received" icon={HandCoins} value={formatMoney(tiles.received.cents)} sub={plural(tiles.received.count, "donation")} />
        <StatTile label="Awarded" icon={Trophy} value={formatMoney(tiles.awarded.cents)} sub={plural(tiles.awarded.count, "scholarship")} />
        <StatTile label="Owed to schools" icon={School} value={formatMoney(tiles.owed.cents)} sub={plural(tiles.owed.schools, "partner school")} />
      </div>

      <Card className="mt-8" aria-labelledby="books">
        <SectionTitle id="books" description={<>Live balances of every ledger account, all years. <Link href="/ledger" className="text-accent hover:underline">Open the ledger</Link></>}>
          Books
        </SectionTitle>
        <KeyValueList items={balances.map((b) => [
          <span key={b.key}>{b.name}</span>,
          <span key={b.key + "v"} className={b.balance === 0n ? "text-text-muted" : ""}>{formatMoney(b.balance)}</span>,
        ])} />
      </Card>
    </>
  );
}
