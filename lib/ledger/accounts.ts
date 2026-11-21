// The chart of accounts (architecture.md › Chart of accounts). Seeded per listing state at setup.
export type AccountType = "asset" | "liability" | "net_assets" | "income" | "expense";
export type AccountDef = { key: string; name: string; type: AccountType; state: string | null };

export function stateAccounts(state: string): AccountDef[] {
  return [
    { key: `asset:stripe:25f:${state}`, name: `Stripe balance, §25F (${state})`, type: "asset", state },
    { key: `asset:bank:25f:${state}`, name: `Segregated §25F bank account (${state})`, type: "asset", state },
    { key: `liability:awards_payable:${state}`, name: `Awarded, not yet paid (${state})`, type: "liability", state },
    { key: `income:contributions:25f:${state}`, name: `Qualified contributions received (${state})`, type: "income", state },
    { key: `income:contribution_refunds:25f:${state}`, name: `Refunds of qualified contributions (${state})`, type: "income", state },
    { key: `income:returned_payments:25f:${state}`, name: `Returned scholarship payments (${state})`, type: "income", state },
    { key: `expense:scholarships:${state}`, name: `Scholarships awarded (${state})`, type: "expense", state },
  ];
}

export const generalAccounts: AccountDef[] = [
  { key: "asset:stripe:general", name: "Stripe balance, general", type: "asset", state: null },
  { key: "asset:bank:operating", name: "Operating bank account", type: "asset", state: null },
  { key: "asset:clearing:deposits", name: "Checks and wires in transit", type: "asset", state: null },
  { key: "asset:clearing:disbursements", name: "ACH sent, not yet settled", type: "asset", state: null },
  { key: "income:contributions:general", name: "General contributions received", type: "income", state: null },
  { key: "income:contribution_refunds:general", name: "Refunds of general contributions", type: "income", state: null },
  { key: "expense:fees:processing", name: "Processing fees", type: "expense", state: null },
  { key: "expense:admin", name: "Administration", type: "expense", state: null },
];

export function chartOfAccounts(states: string[]): AccountDef[] {
  return [...states.flatMap(stateAccounts), ...generalAccounts];
}

/** Where a gift's money sits at Stripe, and the income account it is credited to. */
export function giftAccounts(qualified25f: boolean, state: string | null) {
  if (qualified25f) {
    if (!state) throw new Error("a §25F gift needs a state");
    return { stripe: `asset:stripe:25f:${state}`, income: `income:contributions:25f:${state}` };
  }
  return { stripe: "asset:stripe:general", income: "income:contributions:general" };
}
