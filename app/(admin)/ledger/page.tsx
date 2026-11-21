import type { Metadata } from "next";
import { Badge, Card, PageHeader, SectionTitle, StatTile } from "@/components/ui/display";
import { requireRole } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { accountBalances, trialBalance } from "@/lib/queries/books";

export const metadata: Metadata = { title: "Ledger" };

const TYPE_LABEL: Record<string, string> = {
  asset: "Assets", liability: "Liabilities", net_assets: "Net assets", income: "Income", expense: "Expenses",
};

// S32: Ledger › Accounts. The chart of accounts and the trial balance. Journal (S33) and reconciliation (S34) tabs come later.
export default async function LedgerPage() {
  const ctx = await requireRole(["owner", "admin", "auditor"], "/ledger");
  const [tb, balances] = await Promise.all([trialBalance(ctx), accountBalances(ctx)]);
  const balanced = tb.difference === 0n;
  const groups = Object.keys(TYPE_LABEL)
    .map((t) => ({ type: t, rows: balances.filter((b) => b.type === t) }))
    .filter((g) => g.rows.length > 0);

  return (
    <>
      <PageHeader
        title="Ledger"
        description="Double-entry and append-only: entries are never edited or deleted. A mistake is fixed with a reversing entry."
      />

      <Card aria-labelledby="tb">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="tb" className="text-caption text-text-muted">Trial balance (debits minus credits)</h2>
            <p className="text-display tabular mt-1">{formatMoney(tb.difference)}</p>
          </div>
          {balanced ? <Badge tone="success">Balanced</Badge> : <Badge tone="danger">Out of balance</Badge>}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Debits" value={formatMoney(tb.debits)} />
          <StatTile label="Credits" value={formatMoney(tb.credits)} />
          <StatTile label="Entries" value={tb.entries.toLocaleString("en-US")} />
          <StatTile label="Postings" value={tb.postings.toLocaleString("en-US")} />
        </div>
      </Card>

      <Card className="mt-8 p-0 overflow-hidden" aria-labelledby="coa">
        <div className="px-6 pt-6">
          <SectionTitle id="coa" description="Each balance is the sum of its postings, calculated when you open this page. No balance is stored.">
            Chart of accounts
          </SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Chart of accounts with balances</caption>
            <thead>
              <tr className="border-b border-border text-left text-caption text-text-subtle">
                <th scope="col" className="px-6 py-3 font-semibold">Account</th>
                <th scope="col" className="px-3 py-3 font-semibold">Key</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">Debits</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">Credits</th>
                <th scope="col" className="px-6 py-3 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.type}>
                <tr className="bg-surface">
                  <th scope="rowgroup" colSpan={5} className="px-6 py-2 text-left text-caption font-semibold text-text-muted">{TYPE_LABEL[g.type]}</th>
                </tr>
                {g.rows.map((b) => (
                  <tr key={b.key} className="border-b border-border">
                    <th scope="row" className="px-6 py-3 text-left font-medium">{b.name}</th>
                    <td className="px-3 py-3 font-mono text-caption text-text-muted">{b.key}</td>
                    <td className="px-3 py-3 text-right tabular text-text-muted">{formatMoney(b.debits)}</td>
                    <td className="px-3 py-3 text-right tabular text-text-muted">{formatMoney(b.credits)}</td>
                    <td className="px-6 py-3 text-right tabular font-semibold">{formatMoney(b.balance)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Card>
    </>
  );
}
