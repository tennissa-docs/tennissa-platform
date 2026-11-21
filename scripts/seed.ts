// Seeds the one SGO (TENNISSA), its owner, processor accounts, chart of accounts and the 2027 cap.
// Idempotent: safe to run again. Runs as the database owner. Seeds no money: every gift in the
// books must come from a real (test-mode) payment, so the ledger stays honest even locally.
import { config } from "dotenv";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { chartOfAccounts } from "../lib/ledger/accounts";

config({ path: ".env.local" });
config();

const STATES = ["TN"];

async function main() {
  const sql = postgres(process.env.DATABASE_OWNER_URL!, { max: 1, onnotice: () => {} });
  const ein = process.env.SEED_ORG_EIN ?? "00-0000000";
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@tennissa.test").toLowerCase();

  await sql.begin(async (tx) => {
    let [org] = await tx`select id from orgs order by created_at limit 1`;
    if (!org) {
      [org] = await tx`insert into orgs (name, ein, statement_descriptor, states)
        values ('TENNISSA', ${ein}, 'TENNISSA', ${STATES}) returning id`;
      console.log("created org TENNISSA");
    }

    let [owner] = await tx`select id from users where email = ${ownerEmail}`;
    if (!owner) {
      [owner] = await tx`insert into users (id, email, first_name, last_name)
        values (${randomUUID()}, ${ownerEmail}, 'Owner', 'TENNISSA') returning id`;
      await tx`insert into memberships (user_id, org_id, role) values (${owner.id}, ${org.id}, 'owner')`;
      console.log(`created owner ${ownerEmail}`);
    }

    // processor accounts: real acct_ ids from env, else placeholders charged on the platform account (test mode)
    const accts = [
      { kind: "segregated_25f", state: "TN", id: process.env.STRIPE_ACCOUNT_25F_TN || "platform:25f:TN" },
      { kind: "general", state: null, id: process.env.STRIPE_ACCOUNT_GENERAL || "platform:general" },
    ];
    for (const a of accts) {
      const [row] = await tx`select id, stripe_account_id from processor_accounts
        where org_id = ${org.id} and kind = ${a.kind} and coalesce(state, '--') = coalesce(${a.state}::char(2), '--')`;
      if (!row) {
        await tx`insert into processor_accounts (org_id, kind, state, stripe_account_id, status)
          values (${org.id}, ${a.kind}, ${a.state}, ${a.id}, 'active')`;
        console.log(`added processor account ${a.kind} ${a.state ?? ""} -> ${a.id}`);
      } else if (row.stripe_account_id !== a.id && a.id.startsWith("acct_")) {
        await tx`update processor_accounts set stripe_account_id = ${a.id} where id = ${row.id}`;
        console.log(`connected ${a.kind} ${a.state ?? ""} -> ${a.id}`);
      }
    }

    for (const a of chartOfAccounts(STATES)) {
      await tx`insert into ledger_accounts (key, org_id, name, type, state)
        values (${a.key}, ${org.id}, ${a.name}, ${a.type}, ${a.state}) on conflict (key) do nothing`;
    }

    // configuration, not a constant: the CPA can change it per year
    await tx`insert into credit_caps (tax_year, per_taxpayer_cents) values (2027, 170000) on conflict do nothing`;
  });
  console.log("seed complete");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
